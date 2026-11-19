import type { LatLng } from '@/lib/schedule/optimizer/types';

export type { LatLng };

/** One stop the office might reorder. `lockedAt` is a comparable appointment time. */
export type RouteStopInput = {
  id: string;
  point: LatLng | null;
  /** Set when the visit has a fixed time and must stay in time order. Null means flexible. */
  lockedAt: number | null;
  /** Shown when the stop has no usable point. Same wording as the day map. */
  missingReason: string;
};

export type RouteOptimizeRequest = {
  /** Current schedule order. Straight-line miles "before" follow this order. */
  stops: RouteStopInput[];
  /** Office or other depot. When null, the first routed stop is the start. */
  start: LatLng | null;
};

export type UnroutedStop = {
  id: string;
  reason: string;
};

export type RouteOptimizeResult = {
  /** Routed stop ids. The start point is not included. */
  orderedIds: string[];
  unrouted: UnroutedStop[];
  /** Miles for the input order of routed stops. Straight-line or driving miles. */
  estimatedMilesBefore: number;
  /** Miles for `orderedIds`. Straight-line or driving miles. */
  estimatedMilesAfter: number;
  estimateKind: 'straight-line' | 'drive';
  /** Drive seconds for the input order. Null when `estimateKind` is straight-line. */
  driveSecondsBefore: number | null;
  /** Drive seconds for `orderedIds`. Null when `estimateKind` is straight-line. */
  driveSecondsAfter: number | null;
};

/**
 * One routing engine. The built-in engine is haversine nearest-neighbor plus 2-opt.
 * `createRouteOptimizer()` returns that engine, or the self-hosted Valhalla/VROOM
 * engine when the server is configured for it. Callers should use that factory.
 */
export interface RouteOptimizer {
  readonly engine: 'haversine' | (string & {});
  optimize(request: RouteOptimizeRequest): Promise<RouteOptimizeResult>;
}

export type StopOrderLine = {
  id: string;
  title: string;
  customerName: string;
  locked: boolean;
};

export type CleanerStopOrderView = {
  cleanerUserId: string;
  cleanerName: string;
  dateKey: string;
  /** Where the path starts. */
  startLabel: 'Office' | 'First stop';
  estimateKind: 'straight-line' | 'drive';
  estimatedMilesBefore: number;
  estimatedMilesAfter: number;
  beforeLabel: string;
  afterLabel: string;
  /** `24 min drive · 9.2 mi`. Null for a straight-line estimate. */
  driveBeforeLabel: string | null;
  driveAfterLabel: string | null;
  ordered: StopOrderLine[];
  unrouted: Array<StopOrderLine & { reason: string }>;
  /** True when the saved route_sequence already matches this suggestion. */
  saved: boolean;
  /** False when migration 0130 has not added route_sequence yet. */
  sequenceAvailable: boolean;
};
