import { isOutboundSuppressed, logOutboundSuppressed } from '@/lib/outbound/suppression';
import {
  DISPATCH_NO_CLEANER,
  planDispatchHaversine,
  type DispatchAssignment,
  type DispatchCleanerInput,
  type DispatchPlanRequest,
  type DispatchPlanResult,
  type DispatchPlanVisit,
  type DispatchVisitInput,
} from '@/lib/routing/dispatchPlan';
import { assertRoutingEngineServer } from '@/lib/routing/engineConfig';
import {
  readRoutingEngineConfig,
  readRoutingEngineTimeoutMs,
  routingEngineEnvPresent,
  type RoutingEngineConfig,
} from '@/lib/routing/engineConfig';
import {
  EngineFailure,
  failureReason,
  integerMatrix,
  METERS_PER_MILE,
  NO_ROAD_ROUTE_REASON,
  pathCost,
  postJson,
  readMatrix,
  routableIndexes,
  submatrix,
  usablePoint,
} from '@/lib/routing/engineOptimizer';
import { logRoutingFallback } from '@/lib/routing/routingLog';
import type { LatLng } from '@/lib/schedule/optimizer/types';

type EngineCall = {
  fetchImpl: typeof fetch;
  timeoutMs: number;
};

type GeocodedVisit = DispatchVisitInput & { point: LatLng };

function sortedCleaners(cleaners: DispatchCleanerInput[]): DispatchCleanerInput[] {
  const seen = new Set<string>();
  const rows: DispatchCleanerInput[] = [];
  for (const cleaner of cleaners) {
    const id = cleaner.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({ ...cleaner, id });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

function primaryCleaner(visit: DispatchVisitInput, cleanerIds: Set<string>): string | null {
  return visit.assigneeIds.find((id) => cleanerIds.has(id)) ?? null;
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

function overlaps(a: DispatchVisitInput, b: DispatchVisitInput): boolean {
  return a.startSec < b.endSec && b.startSec < a.endSec;
}

function vehicleWindow(
  cleaner: DispatchCleanerInput,
  pinned: GeocodedVisit[],
): [number, number] | null {
  const starts = pinned.map((visit) => visit.startSec);
  const ends = pinned.map((visit) => visit.endSec);
  let start = cleaner.shiftStartSec;
  let end = cleaner.shiftEndSec;
  if (starts.length > 0) {
    const pinnedStart = Math.min(...starts);
    const pinnedEnd = Math.max(...ends);
    start = start == null ? pinnedStart : Math.min(start, pinnedStart);
    end = end == null ? pinnedEnd : Math.max(end, pinnedEnd);
  }
  if (start == null || end == null || end <= start) return null;
  return [Math.round(start), Math.round(end)];
}

function finiteMatrix(rows: number[][]): boolean {
  return rows.every((row) => row.every((value) => Number.isFinite(value)));
}

async function solveWithEngine(
  request: DispatchPlanRequest,
  config: RoutingEngineConfig,
  call: EngineCall,
): Promise<DispatchPlanResult> {
  const baseline = planDispatchHaversine(request);
  const cleaners = sortedCleaners(request.cleaners);
  const cleanerIds = new Set(cleaners.map((cleaner) => cleaner.id));
  const office = usablePoint(request.office);
  const seen = new Set<string>();
  const geocoded: GeocodedVisit[] = [];
  for (const visit of request.visits) {
    if (seen.has(visit.id)) continue;
    seen.add(visit.id);
    const point = usablePoint(visit.point);
    if (!point) continue;
    if (visit.requiredCleanerIds.length > 1) {
      const have = new Set(visit.assigneeIds);
      if (!visit.requiredCleanerIds.every((id) => have.has(id))) continue;
    }
    geocoded.push({ ...visit, point });
  }
  if (geocoded.length === 0) return baseline;

  const firstStop = geocoded[0];
  if (!firstStop) return baseline;
  const start = office ?? firstStop.point;
  const locations = [start, ...geocoded.map((visit) => visit.point)];
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
  const kept = routableIndexes(matrix.seconds, geocoded.length);
  if (kept.length === 0) throw new EngineFailure('bad-response');
  const keptVisits = kept.map((index) => geocoded[index - 1]).filter((visit) => visit != null);
  const dropped = geocoded.filter((visit) => !keptVisits.includes(visit));
  const locationIndexes = [0, ...kept];
  const seconds = submatrix(matrix.seconds, locationIndexes);
  const miles = submatrix(matrix.miles, locationIndexes);
  if (!finiteMatrix(seconds) || !finiteMatrix(miles)) throw new EngineFailure('bad-response');

  const vehicles: Array<Record<string, unknown>> = [];
  const vehicleByCleaner = new Map<string, number>();
  cleaners.forEach((cleaner) => {
    const pinned = keptVisits.filter((visit) => {
      const pinnedVisit = visit.pinned || visit.assigneeIds.length > 1;
      return pinnedVisit && primaryCleaner(visit, cleanerIds) === cleaner.id;
    });
    const window = vehicleWindow(cleaner, pinned);
    if (!window) return;
    const id = vehicles.length + 1;
    vehicleByCleaner.set(cleaner.id, id);
    const breaks = cleaner.timeOff
      .map((span, index) => {
        const start = Math.max(span.startSec, window[0]);
        const end = Math.min(span.endSec, window[1]);
        if (end <= start) return null;
        const coversPinned = pinned.some((visit) => visit.startSec < end && start < visit.endSec);
        if (coversPinned) return null;
        return {
          id: index + 1,
          service: Math.round(end - start),
          time_windows: [[Math.round(start), Math.round(start)]],
        };
      })
      .filter((item) => item != null);
    const vehicle: Record<string, unknown> = {
      id,
      profile: 'auto',
      start_index: 0,
      time_window: window,
      skills: [id],
    };
    if (breaks.length > 0) vehicle.breaks = breaks;
    vehicles.push(vehicle);
  });
  if (vehicles.length === 0) throw new EngineFailure('bad-response');

  const jobs = keptVisits.map((visit, index) => {
    const duration = Math.max(1, Math.round(visit.endSec - visit.startSec));
    const job: Record<string, unknown> = {
      id: index + 1,
      location_index: index + 1,
      service: duration,
      time_windows: [[Math.round(visit.startSec), Math.round(visit.startSec)]],
    };
    const pinned = visit.pinned || visit.assigneeIds.length > 1;
    if (pinned) {
      const primary = primaryCleaner(visit, cleanerIds);
      const skill = primary ? vehicleByCleaner.get(primary) : undefined;
      if (!skill) throw new EngineFailure('lock-order');
      job.skills = [skill];
    } else if (visit.requiredCleanerIds.length === 1) {
      const skill = vehicleByCleaner.get(visit.requiredCleanerIds[0] ?? '');
      if (!skill) throw new EngineFailure('unassigned');
      job.skills = [skill];
    }
    return job;
  });

  const solved = await postJson(
    `${config.baseUrl}/vroom/`,
    config.token,
    {
      vehicles,
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
    unassigned?: Array<{ id?: unknown }>;
    routes?: Array<{ vehicle?: unknown; steps?: Array<{ type?: unknown; id?: unknown }> }>;
  };
  if (body.code !== 0) throw new EngineFailure('bad-response');

  const cleanerByVehicle = new Map<number, string>();
  for (const [cleanerId, vehicleId] of vehicleByCleaner) cleanerByVehicle.set(vehicleId, cleanerId);
  const orderedByCleaner = new Map<string, string[]>();
  for (const cleaner of cleaners) orderedByCleaner.set(cleaner.id, []);
  const seenJobs = new Set<number>();
  for (const route of body.routes ?? []) {
    if (typeof route.vehicle !== 'number') throw new EngineFailure('bad-response');
    const cleanerId = cleanerByVehicle.get(route.vehicle);
    if (!cleanerId) throw new EngineFailure('bad-response');
    const ids: string[] = [];
    for (const step of route.steps ?? []) {
      if (step.type !== 'job') continue;
      if (typeof step.id !== 'number' || seenJobs.has(step.id))
        throw new EngineFailure('bad-response');
      seenJobs.add(step.id);
      const visit = keptVisits[step.id - 1];
      if (!visit) throw new EngineFailure('bad-response');
      ids.push(visit.id);
    }
    const lockedAt = new Map(
      ids.map((id) => [id, keptVisits.find((visit) => visit.id === id)?.lockedAt ?? null]),
    );
    if (!lockedOrderOk(ids, lockedAt)) throw new EngineFailure('lock-order');
    const chosen = ids
      .map((id) => keptVisits.find((visit) => visit.id === id))
      .filter((visit) => visit != null);
    for (let index = 0; index < chosen.length; index += 1) {
      for (let other = index + 1; other < chosen.length; other += 1) {
        const left = chosen[index];
        const right = chosen[other];
        if (left && right && overlaps(left, right)) throw new EngineFailure('lock-order');
      }
    }
    for (const visit of chosen) {
      const pinned = visit.pinned || visit.assigneeIds.length > 1;
      if (pinned && primaryCleaner(visit, cleanerIds) !== cleanerId) {
        throw new EngineFailure('lock-order');
      }
    }
    orderedByCleaner.set(cleanerId, ids);
  }

  const unassignedIds = new Set<string>();
  for (const row of body.unassigned ?? []) {
    if (typeof row.id !== 'number') throw new EngineFailure('bad-response');
    const visit = keptVisits[row.id - 1];
    if (!visit) throw new EngineFailure('bad-response');
    if (visit.pinned || visit.assigneeIds.length > 1) throw new EngineFailure('unassigned');
    unassignedIds.add(visit.id);
  }
  for (const visit of keptVisits) {
    const placed = [...orderedByCleaner.values()].some((ids) => ids.includes(visit.id));
    if (!placed && !unassignedIds.has(visit.id)) throw new EngineFailure('bad-response');
  }

  const fullIndex = new Map(keptVisits.map((visit, index) => [visit.id, kept[index] ?? -1]));
  const assignments: DispatchAssignment[] = cleaners.map((cleaner) => {
    const orderedIds = orderedByCleaner.get(cleaner.id) ?? [];
    const indexes = orderedIds.map((id) => fullIndex.get(id) ?? -1);
    const driveSeconds = orderedIds.length === 0 ? 0 : pathCost(indexes, matrix.seconds);
    const driveMiles = orderedIds.length === 0 ? 0 : pathCost(indexes, matrix.miles);
    if (!Number.isFinite(driveSeconds) || !Number.isFinite(driveMiles)) {
      throw new EngineFailure('bad-response');
    }
    return {
      cleanerId: cleaner.id,
      orderedIds,
      estimatedMiles: driveMiles,
      driveSeconds,
    };
  });

  const sequence = new Map<string, number>();
  const placedIds = new Set<string>();
  for (const assignment of assignments) {
    assignment.orderedIds.forEach((id, index) => {
      sequence.set(id, index + 1);
      placedIds.add(id);
    });
  }
  const droppedIds = new Set(dropped.map((visit) => visit.id));
  const sourceById = new Map(request.visits.map((visit) => [visit.id, visit]));
  const planVisits: DispatchPlanVisit[] = baseline.visits.map((row) => {
    const source = sourceById.get(row.id);
    const pinned = source ? source.pinned || source.assigneeIds.length > 1 : !row.changeAssignees;
    if (placedIds.has(row.id)) {
      const cleanerId = assignments.find((item) => item.orderedIds.includes(row.id))?.cleanerId;
      return {
        id: row.id,
        assigneeIds: pinned
          ? (source?.assigneeIds ?? row.assigneeIds)
          : cleanerId
            ? [cleanerId]
            : [],
        routeSequence: sequence.get(row.id) ?? null,
        changeAssignees: !pinned,
      };
    }
    if (droppedIds.has(row.id) || unassignedIds.has(row.id)) {
      return {
        id: row.id,
        assigneeIds: pinned ? (source?.assigneeIds ?? row.assigneeIds) : [],
        routeSequence: null,
        changeAssignees: !pinned,
      };
    }
    return row;
  });

  const unassigned = baseline.unassigned.filter(
    (row) => !placedIds.has(row.id) && !droppedIds.has(row.id),
  );
  for (const visit of dropped) {
    unassigned.push({ id: visit.id, reason: NO_ROAD_ROUTE_REASON });
  }
  for (const id of unassignedIds) {
    if (!unassigned.some((row) => row.id === id)) {
      unassigned.push({ id, reason: DISPATCH_NO_CLEANER });
    }
  }
  unassigned.sort((a, b) => a.id.localeCompare(b.id));

  return {
    estimateKind: 'drive',
    assignments,
    unassigned,
    visits: planVisits,
  };
}

/**
 * One VROOM solve for every cleaner on the day.
 * A miss uses the straight-line dispatch plan and does not throw.
 */
export class FleetRouteOptimizer {
  readonly engine = 'valhalla-vroom' as const;

  constructor(private readonly options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {}

  async optimize(request: DispatchPlanRequest): Promise<DispatchPlanResult> {
    const config = readRoutingEngineConfig(process.env);
    if (!config) {
      if (routingEngineEnvPresent(process.env)) logRoutingFallback('invalid-config');
      return planDispatchHaversine(request);
    }
    if (isOutboundSuppressed()) {
      const baseline = planDispatchHaversine(request);
      const placed = baseline.assignments.some((row) => row.orderedIds.length > 0);
      if (!placed) return baseline;
      logOutboundSuppressed('routing', 'dispatch');
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
      return planDispatchHaversine(request);
    }
  }
}

export function createFleetOptimizer(): {
  optimize(request: DispatchPlanRequest): Promise<DispatchPlanResult>;
} {
  assertRoutingEngineServer();
  if (!routingEngineEnvPresent(process.env)) {
    return { optimize: (request) => Promise.resolve(planDispatchHaversine(request)) };
  }
  return new FleetRouteOptimizer();
}
