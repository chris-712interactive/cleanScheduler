import { describe, expect, it } from 'vitest';
import { validateDispatchApply, type DispatchPlanResult } from '@/lib/routing/dispatchPlan';
import {
  buildReoptimizeOffer,
  diffReoptimize,
  holdFixedStops,
  optimizeDayFingerprint,
  reoptimizeScheduleRows,
  routeDayChanged,
} from '@/lib/routing/reoptimize';

const fixed = new Map([['locked', { assigneeIds: ['ada'], routeSequence: 1 }]]);

function plan(): DispatchPlanResult {
  return {
    estimateKind: 'straight-line',
    assignments: [
      {
        cleanerId: 'bea',
        orderedIds: ['locked', 'west'],
        estimatedMiles: 4,
        driveSeconds: null,
      },
    ],
    unassigned: [],
    visits: [
      { id: 'locked', assigneeIds: ['bea'], routeSequence: 1, changeAssignees: true },
      { id: 'west', assigneeIds: ['bea'], routeSequence: 2, changeAssignees: true },
    ],
  };
}

describe('re-optimize', () => {
  it('keeps a finished stop on its cleaner and stop number', () => {
    const held = holdFixedStops(plan(), fixed);
    const locked = held.visits.find((row) => row.id === 'locked');
    expect(locked).toMatchObject({
      assigneeIds: ['ada'],
      routeSequence: 1,
      changeAssignees: false,
    });
    expect(held.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds[0]).toBe('locked');
    const west = held.visits.find((row) => row.id === 'west');
    expect(west?.routeSequence).toBe(1);
    expect(west?.assigneeIds).toEqual(['bea']);
    expect(held.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual(['west']);
  });

  it('shows a diff and does not treat a fixed stop as moved', () => {
    const changes = diffReoptimize({
      visits: [
        { id: 'locked', title: 'Pro locked', fixed: true, cleanerId: 'ada', sequence: 1 },
        { id: 'west', title: 'Pro west', fixed: false, cleanerId: 'ada', sequence: 2 },
      ],
      proposed: [
        { id: 'locked', cleanerId: 'ada', sequence: 1 },
        { id: 'west', cleanerId: 'bea', sequence: 1 },
      ],
    });
    expect(changes.find((row) => row.id === 'locked')).toMatchObject({
      kind: 'fixed',
      detail: 'Pro locked stays fixed',
    });
    expect(changes.find((row) => row.id === 'west')?.kind).toBe('reassigned');
  });

  it('hides the action until an applied day changes', () => {
    const current = optimizeDayFingerprint({
      visits: [
        {
          id: 'west',
          startsAt: '2026-11-20T13:00:00.000Z',
          endsAt: '2026-11-20T14:00:00.000Z',
          status: 'scheduled',
          checkedInAt: null,
          routeSequence: 1,
          assigneeIds: ['ada'],
        },
      ],
      timeOff: [],
    });
    expect(routeDayChanged(null, current, false)).toBe(false);
    expect(routeDayChanged(current, current, true)).toBe(false);
    expect(routeDayChanged('seed-stale', current, true)).toBe(true);
    const moved = optimizeDayFingerprint({
      visits: [
        {
          id: 'west',
          startsAt: '2026-11-20T15:00:00.000Z',
          endsAt: '2026-11-20T16:00:00.000Z',
          status: 'scheduled',
          checkedInAt: null,
          routeSequence: 1,
          assigneeIds: ['ada'],
        },
      ],
      timeOff: [
        { userId: 'ada', startsAt: '2026-11-20T12:00:00.000Z', endsAt: '2026-11-20T13:00:00.000Z' },
      ],
    });
    expect(moved).not.toBe(current);
  });

  it('rejects a stale proposal with the same check dispatch uses', () => {
    const held = holdFixedStops(plan(), fixed);
    const snapshot = [
      {
        id: 'locked',
        startsAt: '2026-11-20T13:00:00.000Z',
        endsAt: '2026-11-20T14:00:00.000Z',
        status: 'scheduled',
        checkedInAt: null,
        routeSequence: 1,
        updatedAt: '2026-11-20T12:00:00.000Z',
        assigneeIds: ['ada'],
      },
      {
        id: 'west',
        startsAt: '2026-11-20T15:00:00.000Z',
        endsAt: '2026-11-20T16:00:00.000Z',
        status: 'scheduled',
        checkedInAt: null,
        routeSequence: 2,
        updatedAt: '2026-11-20T12:00:00.000Z',
        assigneeIds: ['ada'],
      },
    ];
    const offer = buildReoptimizeOffer({
      dateKey: '2026-11-20',
      fingerprint: 'current',
      changeFingerprint: 'now',
      savedFingerprint: 'then',
      hasRouteSequence: true,
      plan: plan(),
      snapshot,
      fixedVisitIds: ['locked'],
      titles: new Map([
        ['locked', 'Pro locked'],
        ['west', 'Pro west'],
      ]),
    });
    expect(offer?.changes.some((row) => row.detail === 'Pro locked stays fixed')).toBe(true);
    expect(
      validateDispatchApply({
        tenantId: 'tenant-a',
        visitTenants: new Map([
          ['locked', 'tenant-a'],
          ['west', 'tenant-a'],
        ]),
        activeCleanerIds: new Set(['ada', 'bea']),
        snapshotIds: ['locked', 'west'],
        actualFingerprint: 'current',
        submittedFingerprint: 'old',
        actualPlanKey: offer?.planKey ?? '',
        submittedPlanKey: offer?.planKey ?? '',
        plan: held,
      }),
    ).toBe('stale');
    expect(
      validateDispatchApply({
        tenantId: 'tenant-a',
        visitTenants: new Map([
          ['locked', 'tenant-b'],
          ['west', 'tenant-a'],
        ]),
        activeCleanerIds: new Set(['ada', 'bea']),
        snapshotIds: ['locked', 'west'],
        actualFingerprint: 'current',
        submittedFingerprint: 'current',
        actualPlanKey: offer?.planKey ?? '',
        submittedPlanKey: offer?.planKey ?? '',
        plan: held,
      }),
    ).toBe('tenant');
  });

  it('reuses the dispatch email snapshot when the order changes', () => {
    const rows = reoptimizeScheduleRows({
      snapshot: [
        {
          id: 'west',
          startsAt: '2026-11-20T15:00:00.000Z',
          endsAt: '2026-11-20T16:00:00.000Z',
          status: 'scheduled',
          checkedInAt: null,
          routeSequence: 2,
          updatedAt: '2026-11-20T12:00:00.000Z',
          assigneeIds: ['ada'],
        },
      ],
      plan: [{ id: 'west', assigneeIds: ['bea'], routeSequence: 1, changeAssignees: true }],
      labels: new Map([['west', { title: 'Pro west', customerName: 'Riley Example' }]]),
    });
    expect(rows.before[0]?.assigneeIds).toEqual(['ada']);
    expect(rows.after[0]?.assigneeIds).toEqual(['bea']);
    expect(rows.after[0]?.routeSequence).toBe(1);
  });
});
