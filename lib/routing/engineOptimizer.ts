import { isOutboundSuppressed, logOutboundSuppressed } from '@/lib/outbound/suppression';
import {
  readRoutingEngineConfig,
  readRoutingEngineTimeoutMs,
  routingEngineEnvPresent,
  type RoutingEngineConfig,
} from '@/lib/routing/engineConfig';
import { optimizeHaversine } from '@/lib/routing/haversineOptimizer';
import { logRoutingFallback } from '@/lib/routing/routingLog';
import type { LatLng } from '@/lib/schedule/optimizer/types';
import type {
  RouteOptimizeRequest,
  RouteOptimizeResult,
  RouteOptimizer,
} from '@/lib/routing/types';

export const NO_ROAD_ROUTE_REASON = 'No road route';

const MAX_LEG_SECONDS = 7 * 24 * 60 * 60;
const METERS_PER_MILE = 1609.344;

type EngineCall = {
  fetchImpl: typeof fetch;
  timeoutMs: number;
};

type RoutedStop = {
  id: string;
  point: LatLng;
  lockedAt: number | null;
};

class EngineFailure extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'EngineFailure';
    this.reason = reason;
  }
}

function usablePoint(point: LatLng | null | undefined): LatLng | null {
  if (!point) return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) return null;
  return { lat: point.lat, lng: point.lng };
}

function finitePair(matrix: number[][], from: number, to: number): boolean {
  const forward = matrix[from]?.[to];
  const back = matrix[to]?.[from];
  return Number.isFinite(forward) && Number.isFinite(back);
}

/** Stops that connect to the start and to every other stop that stays on the route. */
function routableIndexes(seconds: number[][], stopCount: number): number[] {
  let kept: number[] = [];
  for (let index = 1; index <= stopCount; index += 1) {
    if (finitePair(seconds, 0, index)) kept.push(index);
  }
  while (kept.length > 1) {
    let worstCount = 0;
    let worstIndex = -1;
    for (const index of kept) {
      let missing = 0;
      for (const other of kept) {
        if (other !== index && !finitePair(seconds, index, other)) missing += 1;
      }
      if (missing > worstCount) {
        worstCount = missing;
        worstIndex = index;
      }
    }
    if (worstCount === 0 || worstIndex < 0) break;
    kept = kept.filter((index) => index !== worstIndex);
  }
  return kept;
}

function cellNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return Number.NaN;
  if (value > MAX_LEG_SECONDS) return Number.NaN;
  return value;
}

function readMatrix(
  payload: unknown,
  size: number,
): { seconds: number[][]; miles: number[][] } | null {
  if (!payload || typeof payload !== 'object') return null;
  const rows = (payload as { sources_to_targets?: unknown }).sources_to_targets;
  if (!Array.isArray(rows) || rows.length !== size) return null;
  const seconds: number[][] = [];
  const miles: number[][] = [];
  for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length !== size) return null;
    const secondRow: number[] = [];
    const mileRow: number[] = [];
    for (let column = 0; column < size; column += 1) {
      if (rowIndex === column) {
        secondRow.push(0);
        mileRow.push(0);
        continue;
      }
      const cell = row[column];
      if (!cell || typeof cell !== 'object') return null;
      const time = cellNumber((cell as { time?: unknown }).time);
      const distance = cellNumber((cell as { distance?: unknown }).distance);
      secondRow.push(time);
      mileRow.push(Number.isFinite(time) && Number.isFinite(distance) ? distance : Number.NaN);
    }
    seconds.push(secondRow);
    miles.push(mileRow);
  }
  return { seconds, miles };
}

function submatrix(full: number[][], indexes: number[]): number[][] {
  return indexes.map((from) => indexes.map((to) => full[from]?.[to] ?? Number.NaN));
}

function integerMatrix(values: number[][], scale: number): number[][] {
  return values.map((row) => row.map((value) => Math.max(0, Math.round(value * scale))));
}

function pathCost(order: number[], matrix: number[][]): number {
  let total = 0;
  let cursor = 0;
  for (const index of order) {
    const leg = matrix[cursor]?.[index];
    if (typeof leg !== 'number' || !Number.isFinite(leg)) return Number.NaN;
    total += leg;
    cursor = index;
  }
  return total;
}

function lockedOrderOk(ids: string[], lockedAt: Map<string, number | null>): boolean {
  let lastTime = Number.NEGATIVE_INFINITY;
  let lastId = '';
  for (const id of ids) {
    const time = lockedAt.get(id);
    if (time == null) continue;
    if (time < lastTime || (time === lastTime && id.localeCompare(lastId) < 0)) return false;
    lastTime = time;
    lastId = id;
  }
  return true;
}

function lockWindows(
  stops: RoutedStop[],
  durations: number[][],
): Map<string, [number, number]> | null {
  const locked = stops
    .filter((stop) => stop.lockedAt != null)
    .sort((a, b) => {
      const byTime = (a.lockedAt ?? 0) - (b.lockedAt ?? 0);
      if (byTime !== 0) return byTime;
      return a.id.localeCompare(b.id);
    });
  if (locked.length === 0) return null;
  let maxEdge = 0;
  for (const row of durations) {
    for (const value of row) {
      if (value > maxEdge) maxEdge = value;
    }
  }
  const gap = maxEdge * (durations.length + 1) + 1;
  const horizon = (locked.length + 2) * gap;
  const windows = new Map<string, [number, number]>();
  locked.forEach((stop, index) => {
    const open = (index + 1) * gap;
    windows.set(stop.id, [open, open + gap - 1]);
  });
  for (const stop of stops) {
    if (!windows.has(stop.id)) windows.set(stop.id, [0, horizon]);
  }
  return windows;
}

async function postJson(
  url: string,
  token: string,
  body: unknown,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new EngineFailure('error');
  return response.json();
}

function failureReason(error: unknown): string {
  if (error instanceof EngineFailure) return error.reason;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'timeout';
  }
  return 'error';
}

async function solveWithEngine(
  request: RouteOptimizeRequest,
  config: RoutingEngineConfig,
  call: EngineCall,
): Promise<RouteOptimizeResult> {
  const baseline = optimizeHaversine(request);
  if (baseline.orderedIds.length === 0) return baseline;

  const routable = new Set(baseline.orderedIds);
  const seen = new Set<string>();
  const stops: RoutedStop[] = [];
  for (const stop of request.stops) {
    if (!routable.has(stop.id) || seen.has(stop.id) || !stop.point) continue;
    seen.add(stop.id);
    stops.push({ id: stop.id, point: stop.point, lockedAt: stop.lockedAt });
  }
  if (stops.length === 0) return baseline;

  const start = usablePoint(request.start) ?? stops[0]?.point ?? null;
  if (!start) return baseline;
  const locations = [start, ...stops.map((stop) => stop.point)];
  const signal = AbortSignal.timeout(call.timeoutMs);
  const matrixPayload = await postJson(
    `${config.baseUrl}/valhalla/sources_to_targets`,
    config.token,
    {
      sources: locations.map((point) => ({ lat: point.lat, lon: point.lng })),
      targets: locations.map((point) => ({ lat: point.lat, lon: point.lng })),
      costing: 'auto',
      units: 'miles',
    },
    signal,
    call.fetchImpl,
  );
  const matrix = readMatrix(matrixPayload, locations.length);
  if (!matrix) throw new EngineFailure('bad-response');

  const kept = routableIndexes(matrix.seconds, stops.length);
  if (kept.length === 0) throw new EngineFailure('bad-response');
  const keptStops = kept.map((index) => stops[index - 1]).filter((stop) => stop != null);
  const locationIndexes = [0, ...kept];
  const seconds = submatrix(matrix.seconds, locationIndexes);
  const miles = submatrix(matrix.miles, locationIndexes);
  const matrixReady = (rows: number[][]) =>
    rows.every((row) => row.every((value) => Number.isFinite(value)));
  if (!matrixReady(seconds) || !matrixReady(miles)) throw new EngineFailure('bad-response');

  const windows = lockWindows(keptStops, integerMatrix(seconds, 1));
  const jobs = keptStops.map((stop, index) => {
    const job: {
      id: number;
      location_index: number;
      service: number;
      time_windows?: Array<[number, number]>;
    } = {
      id: index + 1,
      location_index: index + 1,
      service: 0,
    };
    const window = windows?.get(stop.id);
    if (window) job.time_windows = [window];
    return job;
  });

  const solved = await postJson(
    `${config.baseUrl}/vroom/`,
    config.token,
    {
      vehicles: [{ id: 1, profile: 'auto', start_index: 0 }],
      jobs,
      matrices: {
        auto: {
          durations: integerMatrix(seconds, 1),
          distances: integerMatrix(miles, METERS_PER_MILE),
        },
      },
    },
    signal,
    call.fetchImpl,
  );

  if (!solved || typeof solved !== 'object') throw new EngineFailure('bad-response');
  const body = solved as {
    code?: unknown;
    unassigned?: unknown;
    routes?: Array<{ steps?: Array<{ type?: unknown; id?: unknown }> }>;
  };
  if (body.code !== 0) throw new EngineFailure('bad-response');
  if (Array.isArray(body.unassigned) && body.unassigned.length > 0) {
    throw new EngineFailure('unassigned');
  }
  const steps = body.routes?.[0]?.steps;
  if (!Array.isArray(steps)) throw new EngineFailure('bad-response');
  const orderedIds: string[] = [];
  for (const step of steps) {
    if (step.type !== 'job') continue;
    if (typeof step.id !== 'number') throw new EngineFailure('bad-response');
    const stop = keptStops[step.id - 1];
    if (!stop) throw new EngineFailure('bad-response');
    orderedIds.push(stop.id);
  }
  if (orderedIds.length !== keptStops.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new EngineFailure('bad-response');
  }
  const lockedAt = new Map(keptStops.map((stop) => [stop.id, stop.lockedAt]));
  if (!lockedOrderOk(orderedIds, lockedAt)) throw new EngineFailure('lock-order');

  const fullIndex = new Map(keptStops.map((stop, index) => [stop.id, kept[index] ?? -1]));
  const orderIndexes = (ids: string[]) => ids.map((id) => fullIndex.get(id) ?? -1);
  const inputIds = stops.map((stop) => stop.id).filter((id) => fullIndex.has(id));
  const secondsBefore = pathCost(orderIndexes(inputIds), matrix.seconds);
  const secondsAfter = pathCost(orderIndexes(orderedIds), matrix.seconds);
  const milesBefore = pathCost(orderIndexes(inputIds), matrix.miles);
  const milesAfter = pathCost(orderIndexes(orderedIds), matrix.miles);
  if (
    !Number.isFinite(secondsBefore) ||
    !Number.isFinite(secondsAfter) ||
    !Number.isFinite(milesBefore) ||
    !Number.isFinite(milesAfter)
  ) {
    throw new EngineFailure('bad-response');
  }

  const dropped = stops
    .filter((stop) => !fullIndex.has(stop.id))
    .map((stop) => ({ id: stop.id, reason: NO_ROAD_ROUTE_REASON }));

  return {
    orderedIds,
    unrouted: [...baseline.unrouted, ...dropped],
    estimatedMilesBefore: milesBefore,
    estimatedMilesAfter: milesAfter,
    estimateKind: 'drive',
    driveSecondsBefore: secondsBefore,
    driveSecondsAfter: secondsAfter,
  };
}

/**
 * Valhalla time matrix plus a VROOM solve for one cleaner.
 * Any miss uses the straight-line optimizer and does not throw.
 */
export class EngineRouteOptimizer implements RouteOptimizer {
  readonly engine = 'valhalla-vroom' as const;

  constructor(private readonly options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {}

  async optimize(request: RouteOptimizeRequest): Promise<RouteOptimizeResult> {
    const config = readRoutingEngineConfig(process.env);
    if (!config) {
      if (routingEngineEnvPresent(process.env)) logRoutingFallback('invalid-config');
      return optimizeHaversine(request);
    }
    if (isOutboundSuppressed()) {
      const baseline = optimizeHaversine(request);
      if (baseline.orderedIds.length === 0) return baseline;
      logOutboundSuppressed('routing', 'optimize');
      logRoutingFallback('suppressed');
      return baseline;
    }
    try {
      return await solveWithEngine(request, config, {
        fetchImpl: this.options.fetchImpl ?? fetch,
        timeoutMs: this.options.timeoutMs ?? readRoutingEngineTimeoutMs(process.env),
      });
    } catch (error) {
      logRoutingFallback(failureReason(error));
      return optimizeHaversine(request);
    }
  }
}
