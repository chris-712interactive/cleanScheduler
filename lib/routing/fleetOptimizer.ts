import { isOutboundSuppressed, logOutboundSuppressed } from '@/lib/outbound/suppression';
import {
  DISPATCH_JOB_CAP,
  DISPATCH_OVERLAP,
  DISPATCH_UNPLACED,
  dailyJobCap,
  flexibleAssignmentBlock,
  heldJobCount,
  heldTeamJobCount,
  jobCapReason,
  planDispatchHaversine,
  visitIsReassignedByDispatch,
  whyFlexibleVisitIsUnassigned,
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
  pathFrom,
  pointsMatch,
  postJson,
  readMatrix,
  routableIndexes,
  routableStopIndexes,
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

/** Time off that is still closed after pinned visits take their own slice of it. */
function unavailablePieces(
  span: { startSec: number; endSec: number },
  pinned: GeocodedVisit[],
  window: [number, number],
): Array<{ startSec: number; endSec: number }> {
  let pieces = [
    {
      startSec: Math.max(span.startSec, window[0]),
      endSec: Math.min(span.endSec, window[1]),
    },
  ].filter((piece) => piece.endSec > piece.startSec);
  for (const visit of pinned) {
    const next: Array<{ startSec: number; endSec: number }> = [];
    for (const piece of pieces) {
      if (visit.endSec <= piece.startSec || visit.startSec >= piece.endSec) {
        next.push(piece);
        continue;
      }
      if (visit.startSec > piece.startSec) {
        next.push({ startSec: piece.startSec, endSec: Math.min(visit.startSec, piece.endSec) });
      }
      if (visit.endSec < piece.endSec) {
        next.push({ startSec: Math.max(visit.endSec, piece.startSec), endSec: piece.endSec });
      }
    }
    pieces = next.filter((piece) => piece.endSec > piece.startSec);
  }
  return pieces;
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
  const shared = office ?? firstStop.point;
  const depots: LatLng[] = [];
  const addDepot = (point: LatLng): number => {
    const found = depots.findIndex((item) => pointsMatch(item, point));
    if (found >= 0) return found;
    depots.push(point);
    return depots.length - 1;
  };
  addDepot(shared);
  const vehicleStart = new Map<string, number>();
  const vehicleEnd = new Map<string, number | null>();
  for (const cleaner of cleaners) {
    vehicleStart.set(cleaner.id, addDepot(usablePoint(cleaner.start) ?? shared));
    const endPoint = usablePoint(cleaner.end);
    vehicleEnd.set(cleaner.id, endPoint ? addDepot(endPoint) : null);
  }
  const locations = [...depots, ...geocoded.map((visit) => visit.point)];
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
  const kept =
    depots.length === 1
      ? routableIndexes(matrix.seconds, geocoded.length)
      : routableStopIndexes(matrix.seconds, depots.length, geocoded.length);
  if (kept.length === 0) throw new EngineFailure('bad-response');
  const keptVisits = kept
    .map((index) => geocoded[index - depots.length])
    .filter((visit) => visit != null);
  const dropped = geocoded.filter((visit) => !keptVisits.includes(visit));
  const locationIndexes = [...depots.map((_, index) => index), ...kept];
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
    let breakId = 1;
    const breaks = cleaner.timeOff.flatMap((span) =>
      unavailablePieces(span, pinned, window).map((piece) => {
        const row = {
          id: breakId,
          service: Math.round(piece.endSec - piece.startSec),
          time_windows: [[Math.round(piece.startSec), Math.round(piece.startSec)]] as Array<
            [number, number]
          >,
        };
        breakId += 1;
        return row;
      }),
    );
    const vehicle: Record<string, unknown> = {
      id,
      profile: 'auto',
      start_index: vehicleStart.get(cleaner.id) ?? 0,
      time_window: window,
      skills: [id],
    };
    const cap = dailyJobCap(cleaner.maxJobsPerDay);
    if (cap != null) {
      const room = Math.max(0, cap - heldJobCount(cleaner.id, request.visits));
      vehicle.max_tasks = pinned.length + room;
    }
    const endIndex = vehicleEnd.get(cleaner.id);
    if (endIndex != null) vehicle.end_index = endIndex;
    if (breaks.length > 0) vehicle.breaks = breaks;
    vehicles.push(vehicle);
  });
  if (vehicles.length === 0) throw new EngineFailure('bad-response');

  const vehicleIds = [...vehicleByCleaner.values()];
  let groupSkill = 1000;
  const jobs = keptVisits.map((visit, index) => {
    const duration = Math.max(1, Math.round(visit.endSec - visit.startSec));
    const job: Record<string, unknown> = {
      id: index + 1,
      location_index: depots.length + index,
      service: duration,
      time_windows: [[Math.round(visit.startSec), Math.round(visit.startSec)]],
    };
    const pinned = visit.pinned || visit.assigneeIds.length > 1;
    const allowed = vehicleIds.filter((vehicleId) => {
      const cleanerId = [...vehicleByCleaner.entries()].find(([, id]) => id === vehicleId)?.[0];
      const cleaner = cleaners.find((row) => row.id === cleanerId);
      if (!cleaner) return false;
      if (pinned) return primaryCleaner(visit, cleanerIds) === cleaner.id;
      return (
        flexibleAssignmentBlock(cleaner, visit, heldJobCount(cleaner.id, request.visits)) == null
      );
    });
    if (pinned && allowed.length === 0) throw new EngineFailure('lock-order');
    if (!pinned && visit.requiredCleanerIds.length === 1 && allowed.length === 0) {
      throw new EngineFailure('unassigned');
    }
    if (!pinned && allowed.length === 0) {
      const skill = groupSkill;
      groupSkill += 1;
      job.skills = [skill];
    } else if (allowed.length === 1) {
      job.skills = allowed;
    } else if (allowed.length > 1 && allowed.length < vehicleIds.length) {
      const skill = groupSkill;
      groupSkill += 1;
      for (const vehicle of vehicles) {
        if (typeof vehicle.id !== 'number' || !allowed.includes(vehicle.id)) continue;
        const skills = vehicle.skills;
        if (Array.isArray(skills)) skills.push(skill);
      }
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

  const rejectedReason = new Map<string, string>();
  for (const cleaner of cleaners) {
    const ids = orderedByCleaner.get(cleaner.id) ?? [];
    const keptIds: string[] = [];
    const held = heldJobCount(cleaner.id, request.visits);
    let added = 0;
    for (const id of ids) {
      const visit = keptVisits.find((row) => row.id === id);
      if (!visit) continue;
      const pinned = visit.pinned || visit.assigneeIds.length > 1;
      if (pinned) {
        if (primaryCleaner(visit, cleanerIds) !== cleaner.id) throw new EngineFailure('lock-order');
        keptIds.push(id);
        continue;
      }
      const blocked = flexibleAssignmentBlock(cleaner, visit, held + added);
      if (blocked) {
        rejectedReason.set(
          id,
          blocked === DISPATCH_JOB_CAP
            ? jobCapReason(heldTeamJobCount(cleaner.id, request.visits))
            : blocked,
        );
        unassignedIds.add(id);
        continue;
      }
      const overlapsKept = keptIds.some((otherId) => {
        const other = keptVisits.find((row) => row.id === otherId);
        return other != null && overlaps(visit, other);
      });
      if (overlapsKept) {
        rejectedReason.set(id, DISPATCH_OVERLAP);
        unassignedIds.add(id);
        continue;
      }
      added += 1;
      keptIds.push(id);
    }
    orderedByCleaner.set(cleaner.id, keptIds);
  }

  const fullIndex = new Map(keptVisits.map((visit, index) => [visit.id, kept[index] ?? -1]));
  const assignments: DispatchAssignment[] = cleaners.map((cleaner) => {
    const orderedIds = orderedByCleaner.get(cleaner.id) ?? [];
    const indexes = orderedIds.map((id) => fullIndex.get(id) ?? -1);
    const driveSeconds =
      orderedIds.length === 0
        ? 0
        : pathFrom(
            vehicleStart.get(cleaner.id) ?? 0,
            indexes,
            vehicleEnd.get(cleaner.id) ?? null,
            matrix.seconds,
          );
    const driveMiles =
      orderedIds.length === 0
        ? 0
        : pathFrom(
            vehicleStart.get(cleaner.id) ?? 0,
            indexes,
            vehicleEnd.get(cleaner.id) ?? null,
            matrix.miles,
          );
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
  const assignedCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();
  for (const cleaner of cleaners) {
    const flexible = (orderedByCleaner.get(cleaner.id) ?? []).filter((id) => {
      const visit = keptVisits.find((row) => row.id === id);
      return visit != null && visitIsReassignedByDispatch(visit);
    }).length;
    assignedCounts.set(cleaner.id, heldJobCount(cleaner.id, request.visits) + flexible);
    teamCounts.set(cleaner.id, heldTeamJobCount(cleaner.id, request.visits));
  }
  for (const id of unassignedIds) {
    if (unassigned.some((row) => row.id === id)) continue;
    const visit = keptVisits.find((row) => row.id === id);
    unassigned.push({
      id,
      reason:
        rejectedReason.get(id) ??
        (visit
          ? whyFlexibleVisitIsUnassigned(visit, cleaners, assignedCounts, teamCounts)
          : DISPATCH_UNPLACED),
    });
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
