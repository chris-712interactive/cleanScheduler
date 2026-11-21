import { createHash } from 'node:crypto';
import { usablePoint } from '@/lib/routing/engineOptimizer';
import { optimizeHaversine, straightLineMiles } from '@/lib/routing/haversineOptimizer';
import type { RouteStopInput } from '@/lib/routing/types';
import { haversineMiles } from '@/lib/schedule/optimizer/geo';
import type { LatLng } from '@/lib/schedule/optimizer/types';

export const DISPATCH_NO_CLEANER = 'No cleaner available';
export const DISPATCH_OUTSIDE_HOURS = 'Outside cleaner hours';
export const DISPATCH_CLEANER_OFF = 'Cleaner is off';
export const DISPATCH_OVERLAP = 'Overlaps another visit';
export const DISPATCH_NEEDS_CREW = 'Needs more than one cleaner';
export const DISPATCH_JOB_CAP = 'At the daily job cap';
export const DISPATCH_UNPLACED = 'Could not place this visit';

const TIE_MILES = 1e-9;

export type DispatchTimeOff = { startSec: number; endSec: number };

export type DispatchCleanerInput = {
  id: string;
  /** Null when this person has no shift on the day. */
  shiftStartSec: number | null;
  shiftEndSec: number | null;
  timeOff: DispatchTimeOff[];
  /** This cleaner's start. Null uses the office, then the first stop. */
  start?: LatLng | null;
  /** Return point. Null ends the path at the last stop. */
  end?: LatLng | null;
  /**
   * `tenant_member_scheduling_profiles.max_jobs_per_day`.
   * Null, missing, and 0 mean no cap. The column only stores null or 1–20;
   * a blank form saves null, and 0 is not a limit.
   */
  maxJobsPerDay?: number | null;
};

export type DispatchVisitInput = {
  id: string;
  point: LatLng | null;
  missingReason: string;
  /** Checked in, completed, fixed arrival, consultation, or an existing team. */
  pinned: boolean;
  lockedAt: number | null;
  startSec: number;
  endSec: number;
  assigneeIds: string[];
  requiredCleanerIds: string[];
  blockedCleanerIds: string[];
};

export type DispatchPlanRequest = {
  visits: DispatchVisitInput[];
  cleaners: DispatchCleanerInput[];
  office: LatLng | null;
};

export type DispatchAssignment = {
  cleanerId: string;
  orderedIds: string[];
  estimatedMiles: number;
  driveSeconds: number | null;
};

export type DispatchPlanVisit = {
  id: string;
  assigneeIds: string[];
  routeSequence: number | null;
  /** False leaves the current crew in place. */
  changeAssignees: boolean;
};

export type DispatchUnassigned = { id: string; reason: string };

export type DispatchPlanResult = {
  estimateKind: 'straight-line' | 'drive';
  assignments: DispatchAssignment[];
  unassigned: DispatchUnassigned[];
  visits: DispatchPlanVisit[];
};

export type DispatchSnapshotVisit = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  checkedInAt: string | null;
  routeSequence: number | null;
  updatedAt: string;
  assigneeIds: string[];
};

type Placed = {
  visit: DispatchVisitInput;
  changeAssignees: boolean;
  assigneeIds: string[];
};

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/**
 * Blank, null, and 0 are unlimited. The scheduler form stores a blank as null,
 * and the column check allows null or 1–20, so 0 is not a real cap.
 */
export function dailyJobCap(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * True when dispatch may move this visit to another cleaner.
 * Locked, team, missing-point, and uncovered multi-cleaner visits stay put.
 */
export function visitIsReassignedByDispatch(visit: DispatchVisitInput): boolean {
  if (!usablePoint(visit.point)) return false;
  if (visit.requiredCleanerIds.length > 1) {
    const have = new Set(visit.assigneeIds);
    if (!visit.requiredCleanerIds.every((id) => have.has(id))) return false;
  }
  if (visit.pinned || visit.assigneeIds.length > 1) return false;
  return true;
}

/** Jobs already on this cleaner today that this suggestion will not move. */
export function heldJobCount(cleanerId: string, visits: readonly DispatchVisitInput[]): number {
  const id = cleanerId.trim();
  if (!id) return 0;
  const seen = new Set<string>();
  let count = 0;
  for (const visit of visits) {
    if (seen.has(visit.id)) continue;
    seen.add(visit.id);
    if (visitIsReassignedByDispatch(visit)) continue;
    if (visit.assigneeIds.includes(id)) count += 1;
  }
  return count;
}

function hasRoomForAnotherJob(cleaner: DispatchCleanerInput, assigned: number): boolean {
  const cap = dailyJobCap(cleaner.maxJobsPerDay);
  if (cap == null) return true;
  return assigned < cap;
}

export type DispatchJobCapBreach = {
  cleanerId: string;
  cap: number;
  assigned: number;
  held: number;
};

/**
 * Rejects a plan that gives a cleaner more jobs than the cap allows on top of
 * visits the plan leaves in place. Visits that already sit on that cleaner and
 * are not reassigned may stay even when they are already over the cap.
 */
export function dispatchJobCapBreach(input: {
  cleaners: readonly Pick<DispatchCleanerInput, 'id' | 'maxJobsPerDay'>[];
  planVisits: readonly DispatchPlanVisit[];
}): DispatchJobCapBreach | null {
  const seenCleaners = new Set<string>();
  for (const cleaner of input.cleaners) {
    const cleanerId = cleaner.id.trim();
    if (!cleanerId || seenCleaners.has(cleanerId)) continue;
    seenCleaners.add(cleanerId);
    const cap = dailyJobCap(cleaner.maxJobsPerDay);
    if (cap == null) continue;
    const seenVisits = new Set<string>();
    let assigned = 0;
    let held = 0;
    for (const visit of input.planVisits) {
      if (seenVisits.has(visit.id)) continue;
      seenVisits.add(visit.id);
      if (!visit.assigneeIds.includes(cleanerId)) continue;
      assigned += 1;
      if (!visit.changeAssignees) held += 1;
    }
    if (assigned > cap && assigned > held) {
      return { cleanerId, cap, assigned, held };
    }
  }
  return null;
}

/** Office line for visits the suggestion could not place, with a count per reason. */
export function dispatchUnassignedNotice(unassigned: readonly { reason: string }[]): string | null {
  if (unassigned.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of unassigned) {
    const reason = row.reason.trim() || DISPATCH_UNPLACED;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${reason} (${count})`);
  const visits = unassigned.length === 1 ? '1 visit' : `${unassigned.length} visits`;
  return `${visits} couldn't be placed. ${parts.join('. ')}.`;
}

function sortedIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function uniqueVisits(visits: DispatchVisitInput[]): DispatchVisitInput[] {
  const seen = new Set<string>();
  const rows: DispatchVisitInput[] = [];
  for (const visit of visits) {
    if (seen.has(visit.id)) continue;
    seen.add(visit.id);
    rows.push({
      ...visit,
      assigneeIds: sortedIds(visit.assigneeIds),
      requiredCleanerIds: sortedIds(visit.requiredCleanerIds),
      blockedCleanerIds: sortedIds(visit.blockedCleanerIds),
    });
  }
  return rows;
}

function uniqueCleaners(cleaners: DispatchCleanerInput[]): DispatchCleanerInput[] {
  const seen = new Set<string>();
  const rows: DispatchCleanerInput[] = [];
  for (const cleaner of cleaners) {
    const id = cleaner.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      ...cleaner,
      id,
      timeOff: cleaner.timeOff.filter((span) => span.endSec > span.startSec),
    });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

function shiftCovers(cleaner: DispatchCleanerInput, visit: DispatchVisitInput): boolean {
  if (cleaner.shiftStartSec == null || cleaner.shiftEndSec == null) return false;
  return visit.startSec >= cleaner.shiftStartSec && visit.endSec <= cleaner.shiftEndSec;
}

function offDuring(cleaner: DispatchCleanerInput, visit: DispatchVisitInput): boolean {
  return cleaner.timeOff.some((span) =>
    intervalsOverlap(visit.startSec, visit.endSec, span.startSec, span.endSec),
  );
}

/**
 * Why a flexible visit cannot be given to this cleaner.
 * Null means the shift, time off, and block list allow it. Pinned visits are not checked.
 */
export function flexibleAssignmentBlock(
  cleaner: DispatchCleanerInput,
  visit: DispatchVisitInput,
  assignedCount = 0,
): string | null {
  if (visit.pinned || visit.assigneeIds.length > 1) return null;
  if (visit.requiredCleanerIds.length === 1 && !visit.requiredCleanerIds.includes(cleaner.id)) {
    return DISPATCH_NO_CLEANER;
  }
  if (!shiftCovers(cleaner, visit)) return DISPATCH_OUTSIDE_HOURS;
  if (offDuring(cleaner, visit)) return DISPATCH_CLEANER_OFF;
  if (visit.blockedCleanerIds.includes(cleaner.id)) return DISPATCH_NO_CLEANER;
  if (!hasRoomForAnotherJob(cleaner, assignedCount)) return DISPATCH_JOB_CAP;
  return null;
}

/** Reason when no cleaner can take a flexible visit. `assignedCounts` includes jobs that stay. */
export function whyFlexibleVisitIsUnassigned(
  visit: DispatchVisitInput,
  cleaners: DispatchCleanerInput[],
  assignedCounts?: ReadonlyMap<string, number>,
): string {
  if (cleaners.length === 0) return DISPATCH_NO_CLEANER;
  const required = visit.requiredCleanerIds.length === 1 ? new Set(visit.requiredCleanerIds) : null;
  const pool = cleaners.filter((cleaner) => (required ? required.has(cleaner.id) : true));
  if (pool.length === 0) return DISPATCH_NO_CLEANER;
  const covered = pool.filter((cleaner) => shiftCovers(cleaner, visit));
  if (covered.length === 0) return DISPATCH_OUTSIDE_HOURS;
  const working = covered.filter((cleaner) => !offDuring(cleaner, visit));
  if (working.length === 0) return DISPATCH_CLEANER_OFF;
  const allowed = working.filter((cleaner) => !visit.blockedCleanerIds.includes(cleaner.id));
  if (allowed.length === 0) return DISPATCH_NO_CLEANER;
  if (assignedCounts) {
    const open = allowed.filter((cleaner) =>
      hasRoomForAnotherJob(cleaner, assignedCounts.get(cleaner.id) ?? 0),
    );
    if (open.length === 0) return DISPATCH_JOB_CAP;
  }
  return DISPATCH_UNPLACED;
}

function overlapsPlaced(
  placed: Map<string, DispatchVisitInput[]>,
  cleanerId: string,
  visit: DispatchVisitInput,
): boolean {
  const rows = placed.get(cleanerId) ?? [];
  return rows.some((other) =>
    intervalsOverlap(visit.startSec, visit.endSec, other.startSec, other.endSec),
  );
}

function anchorFor(
  cleaner: DispatchCleanerInput,
  points: Map<string, LatLng[]>,
  office: LatLng | null,
): LatLng | null {
  const explicit = usablePoint(cleaner.start);
  if (explicit) return explicit;
  const owned = points.get(cleaner.id) ?? [];
  if (owned.length > 0) {
    const lat = owned.reduce((sum, point) => sum + point.lat, 0) / owned.length;
    const lng = owned.reduce((sum, point) => sum + point.lng, 0) / owned.length;
    return { lat, lng };
  }
  return office;
}

function unplacedReason(
  visit: DispatchVisitInput,
  cleaners: DispatchCleanerInput[],
  placed: Map<string, DispatchVisitInput[]>,
  assigned: ReadonlyMap<string, number>,
): string {
  if (cleaners.length === 0) return DISPATCH_NO_CLEANER;
  const required = visit.requiredCleanerIds.length === 1 ? new Set(visit.requiredCleanerIds) : null;
  const pool = cleaners.filter((cleaner) => (required ? required.has(cleaner.id) : true));
  if (pool.length === 0) return DISPATCH_NO_CLEANER;
  const covered = pool.filter((cleaner) => shiftCovers(cleaner, visit));
  if (covered.length === 0) return DISPATCH_OUTSIDE_HOURS;
  const working = covered.filter((cleaner) => !offDuring(cleaner, visit));
  if (working.length === 0) return DISPATCH_CLEANER_OFF;
  const allowed = working.filter((cleaner) => !visit.blockedCleanerIds.includes(cleaner.id));
  if (allowed.length === 0) return DISPATCH_NO_CLEANER;
  const underCap = allowed.filter((cleaner) =>
    hasRoomForAnotherJob(cleaner, assigned.get(cleaner.id) ?? 0),
  );
  if (underCap.length === 0) return DISPATCH_JOB_CAP;
  const open = underCap.filter((cleaner) => !overlapsPlaced(placed, cleaner.id, visit));
  if (open.length === 0) return DISPATCH_OVERLAP;
  return DISPATCH_UNPLACED;
}

function chooseCleaner(
  visit: DispatchVisitInput,
  cleaners: DispatchCleanerInput[],
  placed: Map<string, DispatchVisitInput[]>,
  points: Map<string, LatLng[]>,
  office: LatLng | null,
  assigned: ReadonlyMap<string, number>,
): string | null {
  const required = visit.requiredCleanerIds.length === 1 ? visit.requiredCleanerIds[0] : null;
  let best: DispatchCleanerInput | null = null;
  let bestMiles = Number.POSITIVE_INFINITY;
  for (const cleaner of cleaners) {
    if (required && cleaner.id !== required) continue;
    if (!shiftCovers(cleaner, visit) || offDuring(cleaner, visit)) continue;
    if (visit.blockedCleanerIds.includes(cleaner.id)) continue;
    if (!hasRoomForAnotherJob(cleaner, assigned.get(cleaner.id) ?? 0)) continue;
    if (overlapsPlaced(placed, cleaner.id, visit)) continue;
    const anchor = anchorFor(cleaner, points, office);
    const miles =
      anchor && visit.point ? haversineMiles(anchor, visit.point) : Number.POSITIVE_INFINITY;
    const count = placed.get(cleaner.id)?.length ?? 0;
    const bestCount = best ? (placed.get(best.id)?.length ?? 0) : 0;
    const closer = miles < bestMiles - TIE_MILES;
    const tie =
      best != null &&
      Math.abs(miles - bestMiles) <= TIE_MILES &&
      (count < bestCount || (count === bestCount && cleaner.id.localeCompare(best.id) < 0));
    if (best == null || closer || tie) {
      best = cleaner;
      bestMiles = miles;
    }
  }
  return best?.id ?? null;
}

function countHeldAssignees(
  assigned: Map<string, number>,
  cleanerIds: ReadonlySet<string>,
  assigneeIds: readonly string[],
): void {
  for (const id of assigneeIds) {
    if (!cleanerIds.has(id)) continue;
    assigned.set(id, (assigned.get(id) ?? 0) + 1);
  }
}

function place(
  bags: Map<string, Placed[]>,
  placedVisits: Map<string, DispatchVisitInput[]>,
  points: Map<string, LatLng[]>,
  cleanerId: string,
  visit: DispatchVisitInput,
  changeAssignees: boolean,
  assigneeIds: string[],
): void {
  const row: Placed = { visit, changeAssignees, assigneeIds };
  const bag = bags.get(cleanerId) ?? [];
  bag.push(row);
  bags.set(cleanerId, bag);
  const visits = placedVisits.get(cleanerId) ?? [];
  visits.push(visit);
  placedVisits.set(cleanerId, visits);
  if (visit.point) {
    const owned = points.get(cleanerId) ?? [];
    owned.push(visit.point);
    points.set(cleanerId, owned);
  }
}

function orderCleaner(stops: Placed[], start: LatLng | null, end: LatLng | null): string[] {
  const inputs: RouteStopInput[] = stops.map((stop) => ({
    id: stop.visit.id,
    point: stop.visit.point,
    lockedAt: stop.visit.lockedAt,
    missingReason: stop.visit.missingReason,
  }));
  return optimizeHaversine({ stops: inputs, start, end }).orderedIds;
}

function milesFor(
  ids: string[],
  visits: Map<string, DispatchVisitInput>,
  start: LatLng | null,
  end: LatLng | null,
): number {
  const stops: RouteStopInput[] = ids.map((id) => {
    const visit = visits.get(id);
    return {
      id,
      point: visit?.point ?? null,
      lockedAt: visit?.lockedAt ?? null,
      missingReason: visit?.missingReason ?? 'Missing map point',
    };
  });
  return straightLineMiles({ stops, start, end }, ids);
}

/**
 * Nearest-cleaner assignment with a stable balance tie, then the single-cleaner
 * 2-opt order on each person. Miles are straight-line. Locked and team visits stay
 * with their current crew.
 */
export function planDispatchHaversine(request: DispatchPlanRequest): DispatchPlanResult {
  const cleaners = uniqueCleaners(request.cleaners);
  const cleanerIds = new Set(cleaners.map((cleaner) => cleaner.id));
  const office = usablePoint(request.office);
  const visits = uniqueVisits(request.visits);
  const bags = new Map<string, Placed[]>();
  const placedVisits = new Map<string, DispatchVisitInput[]>();
  const points = new Map<string, LatLng[]>();
  const unassigned: DispatchUnassigned[] = [];
  const held = new Map<string, DispatchPlanVisit>();
  const assigned = new Map<string, number>();
  for (const cleaner of cleaners) assigned.set(cleaner.id, 0);

  const flexible: DispatchVisitInput[] = [];
  for (const visit of visits) {
    const point = usablePoint(visit.point);
    const normalized = point ? { ...visit, point } : { ...visit, point: null };
    if (!point) {
      unassigned.push({
        id: visit.id,
        reason: visit.missingReason.trim() || 'Missing map point',
      });
      held.set(visit.id, {
        id: visit.id,
        assigneeIds: normalized.assigneeIds,
        routeSequence: null,
        changeAssignees: false,
      });
      countHeldAssignees(assigned, cleanerIds, normalized.assigneeIds);
      continue;
    }
    if (normalized.requiredCleanerIds.length > 1) {
      const have = new Set(normalized.assigneeIds);
      const covered = normalized.requiredCleanerIds.every((id) => have.has(id));
      if (!covered) {
        unassigned.push({ id: visit.id, reason: DISPATCH_NEEDS_CREW });
        held.set(visit.id, {
          id: visit.id,
          assigneeIds: normalized.assigneeIds,
          routeSequence: null,
          changeAssignees: false,
        });
        countHeldAssignees(assigned, cleanerIds, normalized.assigneeIds);
        continue;
      }
    }
    if (normalized.pinned || normalized.assigneeIds.length > 1) {
      const primary = normalized.assigneeIds.find((id) => cleanerIds.has(id)) ?? null;
      if (!primary) {
        unassigned.push({ id: visit.id, reason: DISPATCH_NO_CLEANER });
        held.set(visit.id, {
          id: visit.id,
          assigneeIds: normalized.assigneeIds,
          routeSequence: null,
          changeAssignees: false,
        });
        countHeldAssignees(assigned, cleanerIds, normalized.assigneeIds);
        continue;
      }
      place(bags, placedVisits, points, primary, normalized, false, normalized.assigneeIds);
      countHeldAssignees(assigned, cleanerIds, normalized.assigneeIds);
      continue;
    }
    flexible.push(normalized);
  }

  flexible.sort((a, b) => {
    const byLng = (a.point?.lng ?? 0) - (b.point?.lng ?? 0);
    if (byLng !== 0) return byLng;
    const byLat = (a.point?.lat ?? 0) - (b.point?.lat ?? 0);
    if (byLat !== 0) return byLat;
    return a.id.localeCompare(b.id);
  });

  for (const visit of flexible) {
    const cleanerId = chooseCleaner(visit, cleaners, placedVisits, points, office, assigned);
    if (!cleanerId) {
      unassigned.push({
        id: visit.id,
        reason: unplacedReason(visit, cleaners, placedVisits, assigned),
      });
      held.set(visit.id, {
        id: visit.id,
        assigneeIds: [],
        routeSequence: null,
        changeAssignees: true,
      });
      continue;
    }
    place(bags, placedVisits, points, cleanerId, visit, true, [cleanerId]);
    assigned.set(cleanerId, (assigned.get(cleanerId) ?? 0) + 1);
  }

  const byId = new Map(visits.map((visit) => [visit.id, visit]));
  const assignments: DispatchAssignment[] = cleaners.map((cleaner) => {
    const stops = bags.get(cleaner.id) ?? [];
    const start = usablePoint(cleaner.start) ?? office;
    const end = usablePoint(cleaner.end);
    const orderedIds =
      stops.length > 1 ? orderCleaner(stops, start, end) : stops.map((stop) => stop.visit.id);
    return {
      cleanerId: cleaner.id,
      orderedIds,
      estimatedMiles: milesFor(orderedIds, byId, start, end),
      driveSeconds: null,
    };
  });

  const sequence = new Map<string, number>();
  const owner = new Map<string, Placed>();
  for (const assignment of assignments) {
    assignment.orderedIds.forEach((id, index) => sequence.set(id, index + 1));
    for (const stop of bags.get(assignment.cleanerId) ?? []) owner.set(stop.visit.id, stop);
  }

  const planVisits: DispatchPlanVisit[] = visits.map((visit) => {
    const placedStop = owner.get(visit.id);
    if (placedStop) {
      return {
        id: visit.id,
        assigneeIds: placedStop.assigneeIds,
        routeSequence: sequence.get(visit.id) ?? null,
        changeAssignees: placedStop.changeAssignees,
      };
    }
    return (
      held.get(visit.id) ?? {
        id: visit.id,
        assigneeIds: visit.assigneeIds,
        routeSequence: null,
        changeAssignees: false,
      }
    );
  });

  unassigned.sort((a, b) => a.id.localeCompare(b.id) || a.reason.localeCompare(b.reason));
  return {
    estimateKind: 'straight-line',
    assignments,
    unassigned,
    visits: planVisits,
  };
}

export function dispatchFingerprint(visits: DispatchSnapshotVisit[]): string {
  const lines = [...visits]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((visit) =>
      [
        visit.id,
        visit.startsAt,
        visit.endsAt,
        visit.status,
        visit.checkedInAt ?? '',
        visit.routeSequence ?? '',
        sortedIds(visit.assigneeIds).join(','),
        visit.updatedAt,
      ].join('|'),
    );
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function dispatchPlanKey(result: DispatchPlanResult): string {
  const body = {
    estimateKind: result.estimateKind,
    assignments: [...result.assignments]
      .sort((a, b) => a.cleanerId.localeCompare(b.cleanerId))
      .map((row) => ({ cleanerId: row.cleanerId, orderedIds: row.orderedIds })),
    unassigned: [...result.unassigned].sort((a, b) => a.id.localeCompare(b.id)),
    visits: [...result.visits]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((visit) => ({
        id: visit.id,
        assigneeIds: sortedIds(visit.assigneeIds),
        routeSequence: visit.routeSequence,
        changeAssignees: visit.changeAssignees,
      })),
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function validateDispatchApply(input: {
  tenantId: string;
  visitTenants: ReadonlyMap<string, string>;
  activeCleanerIds: ReadonlySet<string>;
  snapshotIds: readonly string[];
  actualFingerprint: string;
  submittedFingerprint: string;
  actualPlanKey: string;
  submittedPlanKey: string;
  plan: DispatchPlanResult;
}): 'ok' | 'stale' | 'tenant' {
  const tenantId = input.tenantId.trim();
  if (!tenantId) return 'tenant';
  if (
    !input.submittedFingerprint ||
    input.submittedFingerprint !== input.actualFingerprint ||
    !input.submittedPlanKey ||
    input.submittedPlanKey !== input.actualPlanKey
  ) {
    return 'stale';
  }
  const snapshot = new Set(input.snapshotIds);
  if (snapshot.size !== input.snapshotIds.length) return 'stale';
  if (input.plan.visits.length !== snapshot.size) return 'stale';
  for (const visit of input.plan.visits) {
    if (!snapshot.has(visit.id)) return 'tenant';
    if (input.visitTenants.get(visit.id) !== tenantId) return 'tenant';
    if (!visit.changeAssignees) continue;
    for (const cleanerId of visit.assigneeIds) {
      if (!input.activeCleanerIds.has(cleanerId)) return 'tenant';
    }
  }
  return 'ok';
}

function zonedParts(
  iso: string,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(read('hour'));
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: hour === 24 ? 0 : hour,
    minute: Number(read('minute')),
    second: Number(read('second')),
  };
}

/** Seconds from local midnight. A later calendar day adds 24 hours. */
export function localDayInterval(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): { startSec: number; endSec: number } | null {
  const start = zonedParts(startsAt, timeZone);
  const end = zonedParts(endsAt, timeZone);
  if (!start || !end) return null;
  const startSec = start.hour * 3600 + start.minute * 60 + start.second;
  let endSec = end.hour * 3600 + end.minute * 60 + end.second;
  const startKey = start.year * 10000 + start.month * 100 + start.day;
  const endKey = end.year * 10000 + end.month * 100 + end.day;
  if (endKey > startKey) endSec += 86400;
  if (endKey < startKey || endSec <= startSec) return null;
  return { startSec, endSec };
}

export function clockToSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 3600 + minute * 60;
}
