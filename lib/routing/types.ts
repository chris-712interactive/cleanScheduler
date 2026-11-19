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
  /** Straight-line miles for the input order of routed stops. */
  estimatedMilesBefore: number;
  /** Straight-line miles for `orderedIds`. */
  estimatedMilesAfter: number;
  estimateKind: 'straight-line';
};

/**
 * One routing engine. The built-in engine is haversine nearest-neighbor plus 2-opt.
 * A later Valhalla/VROOM engine can implement this same contract. Callers should
 * use `createRouteOptimizer()` and not construct an engine themselves.
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
  /** Where the straight-line path starts. */
  startLabel: 'Office' | 'First stop';
  estimatedMilesBefore: number;
  estimatedMilesAfter: number;
  beforeLabel: string;
  afterLabel: string;
  ordered: StopOrderLine[];
  unrouted: Array<StopOrderLine & { reason: string }>;
  /** True when the saved route_sequence already matches this suggestion. */
  saved: boolean;
  /** False when migration 0130 has not added route_sequence yet. */
  sequenceAvailable: boolean;
};
