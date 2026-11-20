import { createHash } from 'node:crypto';
import {
  dispatchPlanKey,
  type DispatchPlanResult,
  type DispatchPlanVisit,
  type DispatchSnapshotVisit,
} from '@/lib/routing/dispatchPlan';
import { scheduleVisitsFromDispatch } from '@/lib/email/cleanerScheduleChange';

export type FixedStop = {
  assigneeIds: string[];
  routeSequence: number | null;
};

export type OptimizeDayVisit = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  checkedInAt: string | null;
  routeSequence: number | null;
  assigneeIds: string[];
};

export type OptimizeTimeOff = {
  userId: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Hash of the day the office last optimized.
 * `updated_at` is left out so saving the order does not look like a new change.
 */
export function optimizeDayFingerprint(input: {
  visits: readonly OptimizeDayVisit[];
  timeOff: readonly OptimizeTimeOff[];
}): string {
  const visits = [...input.visits]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((visit) =>
      [
        visit.id,
        visit.startsAt,
        visit.endsAt,
        visit.status,
        visit.checkedInAt ?? '',
        visit.routeSequence ?? '',
        [...visit.assigneeIds].sort().join(','),
      ].join('|'),
    );
  const timeOff = [...input.timeOff]
    .map((row) => `${row.userId}|${row.startsAt}|${row.endsAt}`)
    .sort();
  return createHash('sha256')
    .update(`${visits.join('\n')}\n${timeOff.join('\n')}`)
    .digest('hex');
}

/** True when an applied order exists and the day no longer matches that apply. */
export function routeDayChanged(
  savedFingerprint: string | null,
  currentFingerprint: string,
  hasAppliedOrder: boolean,
): boolean {
  if (!hasAppliedOrder) return false;
  if (!savedFingerprint) return true;
  return savedFingerprint !== currentFingerprint;
}

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const a = sortedIds(left);
  const b = sortedIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Puts finished, in-progress, and locked stops back on their cleaner and stop
 * number. Open stops keep the optimizer's cleaner and fill the remaining numbers.
 */
export function holdFixedStops(
  plan: DispatchPlanResult,
  fixed: ReadonlyMap<string, FixedStop>,
): DispatchPlanResult {
  if (fixed.size === 0) return plan;

  const visits: DispatchPlanVisit[] = plan.visits.map((visit) => {
    const held = fixed.get(visit.id);
    if (!held) return visit;
    return {
      ...visit,
      assigneeIds: [...held.assigneeIds],
      routeSequence: held.routeSequence,
      changeAssignees: false,
    };
  });

  const cleanerIds = new Set(plan.assignments.map((row) => row.cleanerId));
  for (const row of fixed.values()) {
    const cleanerId = row.assigneeIds[0];
    if (cleanerId) cleanerIds.add(cleanerId);
  }

  const openByCleaner = new Map<string, string[]>();
  for (const id of cleanerIds) openByCleaner.set(id, []);
  for (const assignment of plan.assignments) {
    const open = openByCleaner.get(assignment.cleanerId) ?? [];
    for (const id of assignment.orderedIds) {
      if (!fixed.has(id)) open.push(id);
    }
    openByCleaner.set(assignment.cleanerId, open);
  }

  const sequenceOf = new Map<string, number>();
  const orderedByCleaner = new Map<string, string[]>();
  for (const cleanerId of [...cleanerIds].sort((a, b) => a.localeCompare(b))) {
    const frozen = [...fixed.entries()].filter(([, row]) => row.assigneeIds[0] === cleanerId);
    const used = new Set<number>();
    const seq = new Map<string, number>();
    for (const [id, row] of frozen) {
      if (row.routeSequence == null) continue;
      seq.set(id, row.routeSequence);
      used.add(row.routeSequence);
    }
    let next = 1;
    const take = () => {
      while (used.has(next)) next += 1;
      const value = next;
      used.add(value);
      next += 1;
      return value;
    };
    for (const id of openByCleaner.get(cleanerId) ?? []) seq.set(id, take());
    for (const [id] of frozen) {
      if (!seq.has(id)) seq.set(id, take());
    }
    const orderedIds = [...seq.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([id]) => id);
    orderedByCleaner.set(cleanerId, orderedIds);
    for (const [id, sequence] of seq) sequenceOf.set(id, sequence);
  }

  const assignments = [...cleanerIds]
    .sort((a, b) => a.localeCompare(b))
    .map((cleanerId) => {
      const existing = plan.assignments.find((row) => row.cleanerId === cleanerId);
      const orderedIds = orderedByCleaner.get(cleanerId) ?? [];
      const sameStops =
        existing != null &&
        sameIds(existing.orderedIds, orderedIds) &&
        existing.orderedIds.every((id, index) => id === orderedIds[index]);
      return {
        cleanerId,
        orderedIds,
        estimatedMiles: sameStops ? existing.estimatedMiles : (existing?.estimatedMiles ?? 0),
        driveSeconds: sameStops ? existing.driveSeconds : (existing?.driveSeconds ?? null),
      };
    });

  return {
    estimateKind: plan.estimateKind,
    assignments,
    unassigned: plan.unassigned.filter((row) => !fixed.has(row.id)),
    visits: visits.map((visit) => {
      if (fixed.has(visit.id)) return visit;
      const sequence = sequenceOf.get(visit.id);
      return sequence == null ? visit : { ...visit, routeSequence: sequence };
    }),
  };
}

export type ReoptimizeChange = {
  id: string;
  title: string;
  kind: 'fixed' | 'unchanged' | 'reordered' | 'reassigned';
  detail: string;
};

export function diffReoptimize(input: {
  visits: ReadonlyArray<{
    id: string;
    title: string;
    fixed: boolean;
    cleanerId: string | null;
    sequence: number | null;
  }>;
  proposed: ReadonlyArray<{
    id: string;
    cleanerId: string | null;
    sequence: number | null;
  }>;
}): ReoptimizeChange[] {
  const proposed = new Map(input.proposed.map((row) => [row.id, row]));
  return [...input.visits]
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map((visit) => {
      const next = proposed.get(visit.id);
      if (visit.fixed) {
        return {
          id: visit.id,
          title: visit.title,
          kind: 'fixed' as const,
          detail: `${visit.title} stays fixed`,
        };
      }
      const cleanerChanged = (next?.cleanerId ?? null) !== visit.cleanerId;
      const sequenceChanged = (next?.sequence ?? null) !== visit.sequence;
      if (cleanerChanged) {
        return {
          id: visit.id,
          title: visit.title,
          kind: 'reassigned' as const,
          detail: `${visit.title} moves to another cleaner`,
        };
      }
      if (sequenceChanged) {
        return {
          id: visit.id,
          title: visit.title,
          kind: 'reordered' as const,
          detail: `${visit.title} moves from stop ${visit.sequence ?? '—'} to stop ${next?.sequence ?? '—'}`,
        };
      }
      return {
        id: visit.id,
        title: visit.title,
        kind: 'unchanged' as const,
        detail: `${visit.title} stays`,
      };
    });
}

export function fixedStopsFromSnapshot(
  snapshot: readonly DispatchSnapshotVisit[],
  fixedVisitIds: readonly string[],
): Map<string, FixedStop> {
  const ids = new Set(fixedVisitIds);
  const fixed = new Map<string, FixedStop>();
  for (const row of snapshot) {
    if (!ids.has(row.id)) continue;
    fixed.set(row.id, {
      assigneeIds: [...row.assigneeIds],
      routeSequence: row.routeSequence,
    });
  }
  return fixed;
}

export type ReoptimizeOffer = {
  dateKey: string;
  fingerprint: string;
  planKey: string;
  estimateKind: 'straight-line' | 'drive';
  changes: ReoptimizeChange[];
};

export function buildReoptimizeOffer(input: {
  dateKey: string;
  fingerprint: string;
  changeFingerprint: string;
  savedFingerprint: string | null;
  hasRouteSequence: boolean;
  plan: DispatchPlanResult;
  snapshot: readonly DispatchSnapshotVisit[];
  fixedVisitIds: readonly string[];
  titles: ReadonlyMap<string, string>;
}): ReoptimizeOffer | null {
  const hasApplied = input.savedFingerprint != null || input.hasRouteSequence;
  if (!routeDayChanged(input.savedFingerprint, input.changeFingerprint, hasApplied)) return null;
  const held = heldDispatchPlan(input.plan, input.snapshot, input.fixedVisitIds);
  const proposed = held.plan.visits.map((visit) => ({
    id: visit.id,
    cleanerId: visit.assigneeIds[0] ?? null,
    sequence: visit.routeSequence,
  }));
  const fixed = new Set(input.fixedVisitIds);
  return {
    dateKey: input.dateKey,
    fingerprint: input.fingerprint,
    planKey: held.planKey,
    estimateKind: held.plan.estimateKind,
    changes: diffReoptimize({
      visits: input.snapshot.map((row) => ({
        id: row.id,
        title: input.titles.get(row.id) ?? 'Visit',
        fixed: fixed.has(row.id),
        cleanerId: row.assigneeIds[0] ?? null,
        sequence: row.routeSequence,
      })),
      proposed,
    }),
  };
}

export function heldDispatchPlan(
  plan: DispatchPlanResult,
  snapshot: readonly DispatchSnapshotVisit[],
  fixedVisitIds: readonly string[],
): { plan: DispatchPlanResult; planKey: string } {
  const held = holdFixedStops(plan, fixedStopsFromSnapshot(snapshot, fixedVisitIds));
  return { plan: held, planKey: dispatchPlanKey(held) };
}

/** The same before/after rows Apply dispatch emails. */
export function reoptimizeScheduleRows(input: {
  snapshot: DispatchSnapshotVisit[];
  plan: DispatchPlanVisit[];
  labels?: ReadonlyMap<string, { title: string; customerName: string }>;
}) {
  return scheduleVisitsFromDispatch(input);
}
