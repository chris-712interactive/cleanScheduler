import { haversineMiles } from '@/lib/schedule/optimizer/geo';
import type { LatLng } from '@/lib/schedule/optimizer/types';
import type {
  RouteOptimizeRequest,
  RouteOptimizeResult,
  RouteOptimizer,
  RouteStopInput,
} from '@/lib/routing/types';

const TIE_MILES = 1e-9;

type RoutedStop = RouteStopInput & { point: LatLng; index: number };

function usablePoint(point: LatLng | null | undefined): LatLng | null {
  if (!point) return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) return null;
  return { lat: point.lat, lng: point.lng };
}

function splitStops(stops: RouteStopInput[]): {
  routed: RoutedStop[];
  unrouted: RouteOptimizeResult['unrouted'];
} {
  const routed: RoutedStop[] = [];
  const unrouted: RouteOptimizeResult['unrouted'] = [];
  const seen = new Set<string>();
  stops.forEach((stop, index) => {
    if (seen.has(stop.id)) return;
    seen.add(stop.id);
    const point = usablePoint(stop.point);
    if (!point) {
      const reason = stop.missingReason.trim() || 'Missing map point';
      unrouted.push({ id: stop.id, reason });
      return;
    }
    routed.push({ ...stop, point, index });
  });
  return { routed, unrouted };
}

function pathMiles(ids: string[], points: Map<string, LatLng>, start: LatLng | null): number {
  if (ids.length === 0) return 0;
  let total = 0;
  let cursor = start;
  for (const id of ids) {
    const next = points.get(id);
    if (!next) continue;
    if (cursor) total += haversineMiles(cursor, next);
    cursor = next;
  }
  return total;
}

function lockedSequenceOk(ids: string[], lockedAt: Map<string, number | null>): boolean {
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

function nearestNeighbor(routed: RoutedStop[], start: LatLng): string[] {
  const remaining = new Set(routed.map((stop) => stop.id));
  const locked = routed
    .filter((stop) => stop.lockedAt != null)
    .sort((a, b) => {
      const byTime = (a.lockedAt ?? 0) - (b.lockedAt ?? 0);
      if (byTime !== 0) return byTime;
      return a.id.localeCompare(b.id);
    });
  let nextLocked = 0;
  const order: string[] = [];
  let cursor = start;

  while (remaining.size > 0) {
    const allowedLocked = nextLocked < locked.length ? locked[nextLocked] : null;
    let best: RoutedStop | null = null;
    let bestMiles = Number.POSITIVE_INFINITY;
    for (const stop of routed) {
      if (!remaining.has(stop.id)) continue;
      if (stop.lockedAt != null && stop.id !== allowedLocked?.id) continue;
      const miles = haversineMiles(cursor, stop.point);
      const closer = miles < bestMiles - TIE_MILES;
      const tie =
        best != null &&
        Math.abs(miles - bestMiles) <= TIE_MILES &&
        (stop.index < best.index ||
          (stop.index === best.index && stop.id.localeCompare(best.id) < 0));
      if (best == null || closer || tie) {
        best = stop;
        bestMiles = miles;
      }
    }
    if (!best) break;
    order.push(best.id);
    remaining.delete(best.id);
    if (allowedLocked && best.id === allowedLocked.id) nextLocked += 1;
    cursor = best.point;
  }

  if (order.length !== routed.length) {
    for (const stop of routed) {
      if (!order.includes(stop.id)) order.push(stop.id);
    }
  }
  return order;
}

function twoOpt(
  order: string[],
  points: Map<string, LatLng>,
  lockedAt: Map<string, number | null>,
  start: LatLng,
): string[] {
  let current = order.slice();
  const limit = Math.max(1, current.length * current.length);
  for (let pass = 0; pass < limit; pass += 1) {
    let best = current;
    let bestMiles = pathMiles(current, points, start);
    let improved = false;
    for (let i = 0; i < current.length - 1; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const next = current.slice();
        const slice = next.slice(i, j + 1).reverse();
        next.splice(i, j - i + 1, ...slice);
        if (!lockedSequenceOk(next, lockedAt)) continue;
        const miles = pathMiles(next, points, start);
        if (miles < bestMiles - TIE_MILES) {
          best = next;
          bestMiles = miles;
          improved = true;
        }
      }
    }
    current = best;
    if (!improved) break;
  }
  return current;
}

/** Straight-line stop order. Locked stops stay in time order. Flexible stops move around them. */
export function optimizeHaversine(request: RouteOptimizeRequest): RouteOptimizeResult {
  const { routed, unrouted } = splitStops(request.stops);
  const points = new Map(routed.map((stop) => [stop.id, stop.point]));
  const lockedAt = new Map(routed.map((stop) => [stop.id, stop.lockedAt]));
  const start = usablePoint(request.start) ?? routed[0]?.point ?? null;
  const beforeIds = routed.map((stop) => stop.id);
  let orderedIds = beforeIds;
  if (start && routed.length > 1) {
    const seeded = nearestNeighbor(routed, start);
    orderedIds = twoOpt(seeded, points, lockedAt, start);
  }
  return {
    orderedIds,
    unrouted,
    estimatedMilesBefore: pathMiles(beforeIds, points, start),
    estimatedMilesAfter: pathMiles(orderedIds, points, start),
    estimateKind: 'straight-line',
  };
}

/** Nearest-neighbor seed only, so tests can show that 2-opt does not make the path longer. */
export function haversineNearestNeighborOrder(request: RouteOptimizeRequest): string[] {
  const { routed } = splitStops(request.stops);
  const only = routed[0];
  const start = usablePoint(request.start) ?? only?.point ?? null;
  if (!start || routed.length === 0) return routed.map((stop) => stop.id);
  if (routed.length === 1 && only) return [only.id];
  return nearestNeighbor(routed, start);
}

export function straightLineMiles(request: RouteOptimizeRequest, ids: string[]): number {
  const { routed } = splitStops(request.stops);
  const points = new Map(routed.map((stop) => [stop.id, stop.point]));
  const start = usablePoint(request.start) ?? routed[0]?.point ?? null;
  return pathMiles(ids, points, start);
}

export function formatStraightLineMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '0.0';
  return (Math.round(miles * 10) / 10).toFixed(1);
}

export class HaversineRouteOptimizer implements RouteOptimizer {
  readonly engine = 'haversine' as const;

  optimize(request: RouteOptimizeRequest): Promise<RouteOptimizeResult> {
    return Promise.resolve(optimizeHaversine(request));
  }
}

/**
 * The engine the app uses today. There is no env var and no paid routing call.
 * When a self-hosted Valhalla/VROOM service is approved, return that engine here.
 */
export function createRouteOptimizer(): RouteOptimizer {
  return new HaversineRouteOptimizer();
}
