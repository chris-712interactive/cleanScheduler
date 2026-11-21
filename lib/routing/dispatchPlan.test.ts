import { describe, expect, it } from 'vitest';
import {
  DISPATCH_CLEANER_OFF,
  DISPATCH_JOB_CAP,
  DISPATCH_NEEDS_CREW,
  DISPATCH_NO_CLEANER,
  DISPATCH_OUTSIDE_HOURS,
  DISPATCH_OVERLAP,
  dispatchCapNote,
  dispatchFingerprint,
  dispatchJobCapBreach,
  dispatchPlanKey,
  dispatchUnassignedNotice,
  planDispatchHaversine,
  validateDispatchApply,
  type DispatchCleanerInput,
  type DispatchPlanRequest,
  type DispatchPlanVisit,
  type DispatchVisitInput,
} from '@/lib/routing/dispatchPlan';
import { straightLineMiles } from '@/lib/routing/haversineOptimizer';

const DREW = '11111111-1111-4111-8111-111111111501';
const AVERY = '11111111-1111-4111-8111-111111111510';
const BLAKE = '11111111-1111-4111-8111-111111111511';

function cleaner(
  id: string,
  startHour = 6,
  endHour = 21,
  timeOff: DispatchCleanerInput['timeOff'] = [],
  maxJobsPerDay: number | null = null,
): DispatchCleanerInput {
  return {
    id,
    shiftStartSec: startHour * 3600,
    shiftEndSec: endHour * 3600,
    timeOff,
    maxJobsPerDay,
  };
}

function visit(
  partial: Partial<DispatchVisitInput> & Pick<DispatchVisitInput, 'id'>,
): DispatchVisitInput {
  return {
    point: { lat: 35.5, lng: -82.55 },
    missingReason: 'Missing map point',
    pinned: false,
    lockedAt: null,
    startSec: 9 * 3600,
    endSec: 10 * 3600,
    assigneeIds: [],
    requiredCleanerIds: [],
    blockedCleanerIds: [],
    ...partial,
  };
}

function officeDay(): DispatchPlanRequest {
  return {
    office: { lat: 35.55, lng: -82.55 },
    cleaners: [cleaner(DREW), cleaner(AVERY), cleaner(BLAKE)],
    visits: [
      visit({
        id: 'west',
        point: { lat: 35.5, lng: -82.8 },
        startSec: 8 * 3600,
        endSec: 9 * 3600,
        assigneeIds: [DREW],
      }),
      visit({
        id: 'locked',
        point: { lat: 35.6, lng: -82.4 },
        startSec: 9 * 3600,
        endSec: 10 * 3600,
        assigneeIds: [DREW],
        pinned: true,
        lockedAt: 2,
      }),
      visit({
        id: 'south',
        point: { lat: 35.4, lng: -82.55 },
        startSec: 14 * 3600,
        endSec: 15 * 3600,
        assigneeIds: [DREW],
      }),
      visit({
        id: 'casey',
        point: { lat: 35.5, lng: -82.8 },
        startSec: 11 * 3600,
        endSec: 12 * 3600,
        assigneeIds: [AVERY],
      }),
      visit({
        id: 'cabin',
        point: null,
        missingReason: "Couldn't locate this address",
        startSec: 15 * 3600,
        endSec: 16 * 3600,
        assigneeIds: [DREW],
      }),
    ],
  };
}

describe('multi-cleaner dispatch plan', () => {
  it('keeps a locked visit on its cleaner and balances the flexible stops', () => {
    const first = planDispatchHaversine(officeDay());
    const second = planDispatchHaversine(officeDay());
    expect(second).toEqual(first);
    const byCleaner = new Map(first.assignments.map((row) => [row.cleanerId, row.orderedIds]));
    expect(byCleaner.get(DREW)).toEqual(['locked']);
    expect(byCleaner.get(AVERY)).toEqual(['casey', 'west']);
    expect(byCleaner.get(BLAKE)).toEqual(['south']);
    expect(first.estimateKind).toBe('straight-line');
    expect(first.unassigned).toEqual([{ id: 'cabin', reason: "Couldn't locate this address" }]);
    const locked = first.visits.find((row) => row.id === 'locked');
    expect(locked).toMatchObject({
      assigneeIds: [DREW],
      changeAssignees: false,
      routeSequence: 1,
    });
    const west = first.visits.find((row) => row.id === 'west');
    expect(west).toMatchObject({ assigneeIds: [AVERY], changeAssignees: true, routeSequence: 2 });
    const cabin = first.visits.find((row) => row.id === 'cabin');
    expect(cabin).toMatchObject({
      assigneeIds: [DREW],
      changeAssignees: false,
      routeSequence: null,
    });
    for (const assignment of first.assignments) {
      const stops = officeDay().visits.filter((row) => assignment.orderedIds.includes(row.id));
      const miles = straightLineMiles(
        {
          stops: stops.map((row) => ({
            id: row.id,
            point: row.point,
            lockedAt: row.lockedAt,
            missingReason: row.missingReason,
          })),
          start: { lat: 35.55, lng: -82.55 },
        },
        assignment.orderedIds,
      );
      expect(assignment.estimatedMiles).toBeCloseTo(miles, 6);
      expect(assignment.driveSeconds).toBeNull();
    }
  });

  it('does not split a team or assign over time off, hours, or an overlap', () => {
    const plan = planDispatchHaversine({
      office: { lat: 0, lng: 0 },
      cleaners: [
        cleaner('near', 8, 17),
        cleaner('off', 8, 17, [{ startSec: 9 * 3600, endSec: 12 * 3600 }]),
      ],
      visits: [
        visit({
          id: 'team',
          point: { lat: 0.2, lng: 0.2 },
          assigneeIds: ['off', 'near'],
          pinned: true,
          startSec: 13 * 3600,
          endSec: 14 * 3600,
        }),
        visit({
          id: 'during-off',
          point: { lat: 0, lng: 0.1 },
          startSec: 9 * 3600,
          endSec: 10 * 3600,
        }),
        visit({
          id: 'same-time',
          point: { lat: 0, lng: 0.2 },
          startSec: 9 * 3600,
          endSec: 10 * 3600,
        }),
        visit({
          id: 'late',
          point: { lat: 1, lng: 1 },
          startSec: 18 * 3600,
          endSec: 19 * 3600,
        }),
        visit({
          id: 'crew',
          requiredCleanerIds: ['near', 'off'],
          assigneeIds: [],
          startSec: 15 * 3600,
          endSec: 16 * 3600,
        }),
      ],
    });
    expect(plan.visits.find((row) => row.id === 'team')).toMatchObject({
      assigneeIds: ['near', 'off'],
      changeAssignees: false,
    });
    expect(plan.assignments.find((row) => row.cleanerId === 'near')?.orderedIds).toEqual(
      expect.arrayContaining(['team', 'during-off']),
    );
    expect(plan.assignments.find((row) => row.cleanerId === 'off')?.orderedIds).toEqual([]);
    expect(plan.unassigned).toEqual([
      { id: 'crew', reason: DISPATCH_NEEDS_CREW },
      { id: 'late', reason: DISPATCH_OUTSIDE_HOURS },
      { id: 'same-time', reason: DISPATCH_OVERLAP },
    ]);
  });

  it('leaves every visit unassigned when nobody is working', () => {
    const plan = planDispatchHaversine({
      office: null,
      cleaners: [cleaner('away', 8, 17, [{ startSec: 8 * 3600, endSec: 17 * 3600 }])],
      visits: [visit({ id: 'only', startSec: 9 * 3600, endSec: 10 * 3600 })],
    });
    expect(plan.assignments[0]?.orderedIds).toEqual([]);
    expect(plan.unassigned).toEqual([{ id: 'only', reason: DISPATCH_CLEANER_OFF }]);
    expect(plan.visits[0]).toMatchObject({
      changeAssignees: true,
      assigneeIds: [],
      routeSequence: null,
    });
  });

  it('rejects a stale fingerprint and a cleaner from another workspace', () => {
    const plan = planDispatchHaversine(officeDay());
    const snapshot = plan.visits.map((row) => ({
      id: row.id,
      startsAt: '2026-11-20T13:00:00.000Z',
      endsAt: '2026-11-20T14:00:00.000Z',
      status: 'scheduled',
      checkedInAt: null,
      routeSequence: null,
      updatedAt: '2026-11-20T12:00:00.000Z',
      assigneeIds: row.assigneeIds,
    }));
    const fingerprint = dispatchFingerprint(snapshot);
    const planKey = dispatchPlanKey(plan);
    const base = {
      tenantId: 'tenant-a',
      visitTenants: new Map(plan.visits.map((row) => [row.id, 'tenant-a'])),
      activeCleanerIds: new Set([DREW, AVERY, BLAKE]),
      snapshotIds: plan.visits.map((row) => row.id),
      actualFingerprint: fingerprint,
      submittedFingerprint: fingerprint,
      actualPlanKey: planKey,
      submittedPlanKey: planKey,
      plan,
    };
    expect(validateDispatchApply(base)).toBe('ok');
    expect(validateDispatchApply({ ...base, submittedFingerprint: 'nope' })).toBe('stale');
    expect(validateDispatchApply({ ...base, submittedPlanKey: 'nope' })).toBe('stale');
    const foreign = {
      ...plan,
      visits: plan.visits.map((row) =>
        row.id === 'west' ? { ...row, assigneeIds: ['other-tenant-cleaner'] } : row,
      ),
    };
    expect(
      validateDispatchApply({
        ...base,
        plan: foreign,
        actualPlanKey: dispatchPlanKey(foreign),
        submittedPlanKey: dispatchPlanKey(foreign),
      }),
    ).toBe('tenant');
    const moved = new Map(base.visitTenants);
    moved.set('west', 'tenant-b');
    expect(validateDispatchApply({ ...base, visitTenants: moved })).toBe('tenant');
    const firstStamp = snapshot[0];
    if (!firstStamp) throw new Error('missing snapshot');
    expect(dispatchFingerprint(snapshot)).not.toBe(
      dispatchFingerprint([
        { ...firstStamp, updatedAt: '2026-11-20T12:00:01.000Z' },
        ...snapshot.slice(1),
      ]),
    );
  });

  it('stops assigning once a cleaner reaches max jobs for the day', () => {
    const plan = planDispatchHaversine({
      office: { lat: 0, lng: 0 },
      cleaners: [cleaner('ada', 8, 17, [], 1), cleaner('bea', 8, 17, [], 1)],
      visits: [
        visit({
          id: 'early',
          point: { lat: 0.1, lng: 0.1 },
          startSec: 9 * 3600,
          endSec: 10 * 3600,
        }),
        visit({ id: 'mid', point: { lat: 0.2, lng: 0.2 }, startSec: 11 * 3600, endSec: 12 * 3600 }),
        visit({
          id: 'late',
          point: { lat: 0.3, lng: 0.3 },
          startSec: 13 * 3600,
          endSec: 14 * 3600,
        }),
      ],
    });
    const placed = plan.assignments.flatMap((row) => row.orderedIds);
    expect(placed).toHaveLength(2);
    expect(plan.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toHaveLength(1);
    expect(plan.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toHaveLength(1);
    expect(plan.unassigned).toEqual([{ id: 'late', reason: DISPATCH_JOB_CAP }]);
    expect(plan.visits.find((row) => row.id === 'late')).toMatchObject({
      assigneeIds: [],
      changeAssignees: true,
    });
    expect(dispatchUnassignedNotice(plan.unassigned)).toBe(
      "1 visit couldn't be placed. At the daily job cap (1).",
    );
  });

  it('counts jobs that stay on the cleaner and does not count jobs being reassigned', () => {
    const plan = planDispatchHaversine({
      office: { lat: 0, lng: 0 },
      cleaners: [cleaner('ada', 8, 17, [], 2), cleaner('bea', 8, 17, [], 1)],
      visits: [
        visit({
          id: 'pinned',
          pinned: true,
          lockedAt: 1,
          assigneeIds: ['ada'],
          startSec: 8 * 3600,
          endSec: 9 * 3600,
        }),
        visit({
          id: 'team',
          pinned: true,
          assigneeIds: ['ada', 'bea'],
          startSec: 9 * 3600,
          endSec: 10 * 3600,
        }),
        visit({
          id: 'movable',
          assigneeIds: ['ada'],
          point: { lat: 1, lng: 1 },
          startSec: 12 * 3600,
          endSec: 13 * 3600,
        }),
        visit({
          id: 'other',
          point: { lat: 0.2, lng: 0.2 },
          startSec: 14 * 3600,
          endSec: 15 * 3600,
        }),
      ],
    });
    expect(plan.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual(
      expect.arrayContaining(['pinned', 'team']),
    );
    expect(plan.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).not.toContain(
      'movable',
    );
    expect(plan.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual([]);
    expect(plan.unassigned.map((row) => row.id).sort()).toEqual(['movable', 'other']);
    expect(plan.unassigned.every((row) => row.reason === DISPATCH_JOB_CAP)).toBe(false);
    expect(
      plan.unassigned.every((row) => row.reason === 'At the daily job cap (includes 1 team visit)'),
    ).toBe(true);
  });

  it('names team visits that fill a cleaner whose route does not list them', () => {
    const plan = planDispatchHaversine({
      office: { lat: 0, lng: 0 },
      cleaners: [cleaner('ada', 8, 17, [], 2), cleaner('bea', 8, 17, [], 2)],
      visits: [
        visit({
          id: 'team-a',
          pinned: true,
          assigneeIds: ['ada', 'bea'],
          startSec: 8 * 3600,
          endSec: 9 * 3600,
        }),
        visit({
          id: 'team-b',
          pinned: true,
          assigneeIds: ['ada', 'bea'],
          startSec: 9 * 3600,
          endSec: 10 * 3600,
        }),
        visit({
          id: 'extra',
          point: { lat: 0.4, lng: 0.4 },
          startSec: 12 * 3600,
          endSec: 13 * 3600,
        }),
      ],
    });
    expect(plan.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual(
      expect.arrayContaining(['team-a', 'team-b']),
    );
    expect(plan.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual([]);
    expect(plan.unassigned).toEqual([
      { id: 'extra', reason: 'At the daily job cap (includes 2 team visits)' },
    ]);
    expect(dispatchCapNote({ maxJobsPerDay: 2, assigned: 2, teamVisits: 2 })).toBe(
      'At the daily job cap (includes 2 team visits)',
    );
    expect(dispatchCapNote({ maxJobsPerDay: 3, assigned: 2, teamVisits: 2 })).toBe(
      'Near the daily job cap (includes 2 team visits)',
    );
  });

  it('treats a null or zero daily cap as unlimited', () => {
    const visits = [
      visit({ id: 'one', point: { lat: 0.1, lng: 0.1 }, startSec: 9 * 3600, endSec: 10 * 3600 }),
      visit({ id: 'two', point: { lat: 0.2, lng: 0.2 }, startSec: 11 * 3600, endSec: 12 * 3600 }),
      visit({ id: 'three', point: { lat: 0.4, lng: 0.4 }, startSec: 13 * 3600, endSec: 14 * 3600 }),
    ];
    for (const maxJobsPerDay of [null, 0]) {
      const plan = planDispatchHaversine({
        office: { lat: 0, lng: 0 },
        cleaners: [cleaner('ada', 8, 17, [], maxJobsPerDay)],
        visits,
      });
      expect(plan.unassigned).toEqual([]);
      expect(plan.assignments[0]?.orderedIds).toHaveLength(3);
    }
  });

  it('re-checks the daily cap before a plan is saved', () => {
    const withinCap: DispatchPlanVisit[] = [
      { id: 'kept', assigneeIds: ['ada'], routeSequence: 1, changeAssignees: false },
      { id: 'added', assigneeIds: ['ada'], routeSequence: 2, changeAssignees: true },
    ];
    expect(
      dispatchJobCapBreach({
        cleaners: [{ id: 'ada', maxJobsPerDay: 2 }],
        planVisits: withinCap,
      }),
    ).toBeNull();
    expect(
      dispatchJobCapBreach({
        cleaners: [{ id: 'ada', maxJobsPerDay: 1 }],
        planVisits: [
          { id: 'kept', assigneeIds: ['ada'], routeSequence: 1, changeAssignees: false },
        ],
      }),
    ).toBeNull();
    expect(
      dispatchJobCapBreach({
        cleaners: [
          { id: 'ada', maxJobsPerDay: null },
          { id: 'bea', maxJobsPerDay: 0 },
        ],
        planVisits: [
          { id: 'a', assigneeIds: ['ada'], routeSequence: 1, changeAssignees: true },
          { id: 'b', assigneeIds: ['ada'], routeSequence: 2, changeAssignees: true },
          { id: 'c', assigneeIds: ['bea'], routeSequence: 1, changeAssignees: true },
          { id: 'd', assigneeIds: ['bea'], routeSequence: 2, changeAssignees: true },
        ],
      }),
    ).toBeNull();
    expect(
      dispatchJobCapBreach({
        cleaners: [{ id: 'ada', maxJobsPerDay: 1 }],
        planVisits: withinCap,
      }),
    ).toEqual({ cleanerId: 'ada', cap: 1, assigned: 2, held: 1 });
  });

  it('names a missing crew when no cleaner is on the plan', () => {
    const plan = planDispatchHaversine({
      office: { lat: 0, lng: 0 },
      cleaners: [],
      visits: [visit({ id: 'open' })],
    });
    expect(plan.unassigned).toEqual([{ id: 'open', reason: DISPATCH_NO_CLEANER }]);
  });
});
