import { describe, expect, it } from 'vitest';
import { planOptimizedDay } from '@/lib/schedule/optimizer/planDay';
import {
  defaultScheduleOptimizerPolicy,
  resolveScheduleOptimizerPolicy,
} from '@/lib/schedule/optimizer/policy';
import type {
  OptimizerCrewMember,
  OptimizerJob,
  ScheduleOptimizerPolicy,
} from '@/lib/schedule/optimizer/types';

function crew(
  overrides: Partial<OptimizerCrewMember> & Pick<OptimizerCrewMember, 'userId'>,
): OptimizerCrewMember {
  return {
    home: null,
    office: null,
    availableStartMin: 8 * 60,
    availableEndMin: 17 * 60,
    timeOff: [],
    existingJobs: [],
    skillTags: [],
    certificationTags: [],
    equipmentTags: [],
    attributeTags: [],
    languageCodes: [],
    propertyKinds: [],
    handlesPets: true,
    handlesChemicalSensitivity: true,
    maxJobsPerDay: null,
    maxMinutesPerDay: null,
    maxDriveMinutesBetweenStops: null,
    preferredZoneIds: [],
    preferredPartnerIds: [],
    avoidPartnerIds: [],
    experienceLevel: 'standard',
    priorWeekendJobs: 0,
    isWeekend: false,
    ...overrides,
  };
}

function job(overrides: Partial<OptimizerJob> & Pick<OptimizerJob, 'id'>): OptimizerJob {
  return {
    durationMinutes: 120,
    location: null,
    zoneId: null,
    postalCode: null,
    buildingKey: null,
    propertyKind: 'residential',
    preferredUserIds: [],
    requiredUserIds: [],
    blockedUserIds: [],
    requiredSkillTags: [],
    requiredCertificationTags: [],
    requiredEquipmentTags: [],
    requiredAttributeTags: [],
    languageCodes: [],
    petInHome: false,
    chemicalSensitivity: false,
    requiredCrewSize: 1,
    arrivalWindow: null,
    accessWindow: null,
    priority: 3,
    revenueCents: 15000,
    recurringAnchorUserId: null,
    standingStartMin: null,
    isFirstVisit: false,
    requiresKeyPickup: false,
    lockedAssigneeIds: null,
    lockedStartMin: null,
    ...overrides,
  };
}

function withWeights(
  policy: ScheduleOptimizerPolicy,
  updates: Record<string, { weight?: number; mode?: 'hard' | 'soft'; enabled?: boolean }>,
): ScheduleOptimizerPolicy {
  const factors = { ...policy.factors };
  for (const [id, update] of Object.entries(updates)) {
    const current = factors[id];
    if (!current) continue;
    factors[id] = { ...current, ...update };
  }
  return { ...policy, factors };
}

describe('resolveScheduleOptimizerPolicy', () => {
  it('fills new factors when a saved policy is empty or partial', () => {
    const resolved = resolveScheduleOptimizerPolicy({
      factors: { travel_distance: { enabled: false, weight: 10, mode: 'soft' } },
      assumptions: { travelSpeedMph: 99, bufferMinutes: 5, maxDriveMinutes: 30 },
    });

    expect(resolved.factors.travel_distance).toEqual({
      enabled: false,
      weight: 10,
      mode: 'soft',
    });
    expect(resolved.factors.crew_availability?.enabled).toBe(true);
    expect(resolved.assumptions.travelSpeedMph).toBe(70);
    expect(resolved.assumptions.bufferMinutes).toBe(5);
    expect(resolved.factors.preferred_cleaner?.mode).toBe('soft');
  });
});

describe('planOptimizedDay', () => {
  it('keeps a blocked cleaner off the job while the factor is hard', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [crew({ userId: 'alex' }), crew({ userId: 'blair' })],
      jobs: [job({ id: 'home-a', blockedUserIds: ['alex'] })],
    });

    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments[0]?.userIds).toEqual(['blair']);
  });

  it('allows a blocked cleaner when that factor is turned off', () => {
    const policy = withWeights(defaultScheduleOptimizerPolicy(), {
      customer_blocked_crew: { enabled: false },
      workload_balance: { weight: 0 },
    });
    const plan = planOptimizedDay({
      policy,
      crew: [crew({ userId: 'alex' }), crew({ userId: 'blair' })],
      jobs: [job({ id: 'home-a', blockedUserIds: ['alex'] })],
    });

    expect(plan.assignments[0]?.userIds).toEqual(['alex']);
  });

  it('sends the job to the closer home when drive time outweighs a preference', () => {
    const policy = withWeights(defaultScheduleOptimizerPolicy(), {
      travel_distance: { weight: 100 },
      preferred_cleaner: { weight: 0 },
      workload_balance: { weight: 0 },
      job_value_placement: { weight: 0 },
      customer_priority: { weight: 0 },
      start_of_day_from_home: { weight: 0 },
    });
    const plan = planOptimizedDay({
      policy,
      crew: [
        crew({ userId: 'far', home: { lat: 27.3, lng: -82.5 } }),
        crew({ userId: 'near', home: { lat: 26.64, lng: -81.87 } }),
      ],
      jobs: [
        job({
          id: 'babcock',
          location: { lat: 26.72, lng: -81.76 },
          preferredUserIds: ['far'],
        }),
      ],
    });

    expect(plan.assignments[0]?.userIds).toEqual(['near']);
    expect(plan.assignments[0]?.travelMinutesBefore).toBeGreaterThan(0);
  });

  it('keeps the preferred cleaner when that weight is turned all the way up', () => {
    const policy = withWeights(defaultScheduleOptimizerPolicy(), {
      travel_distance: { weight: 1 },
      start_of_day_from_home: { weight: 0 },
      preferred_cleaner: { weight: 100 },
      workload_balance: { weight: 0 },
      job_value_placement: { weight: 0 },
      customer_priority: { weight: 0 },
      drive_vs_job_length: { weight: 0 },
    });
    const plan = planOptimizedDay({
      policy,
      crew: [
        crew({ userId: 'far', home: { lat: 27.3, lng: -82.5 } }),
        crew({ userId: 'near', home: { lat: 26.64, lng: -81.87 } }),
      ],
      jobs: [
        job({
          id: 'babcock',
          location: { lat: 26.72, lng: -81.76 },
          preferredUserIds: ['far'],
        }),
      ],
    });

    expect(plan.assignments[0]?.userIds).toEqual(['far']);
  });

  it('leaves a job unassigned once a cleaner hits a hard daily job cap', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [crew({ userId: 'alex', maxJobsPerDay: 1 })],
      jobs: [job({ id: 'one', durationMinutes: 60 }), job({ id: 'two', durationMinutes: 60 })],
    });

    expect(plan.assignments).toHaveLength(1);
    expect(plan.unassigned.map((entry) => entry.jobId)).toEqual(['two']);
    expect(plan.unassigned[0]?.reasons.join(' ')).toMatch(/job cap/i);
  });

  it('does not overlap a job already on the calendar', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [
        crew({
          userId: 'alex',
          existingJobs: [
            {
              id: 'pinned',
              startMin: 8 * 60,
              endMin: 16 * 60,
              location: null,
              zoneId: null,
              postalCode: null,
              buildingKey: null,
            },
          ],
        }),
      ],
      jobs: [job({ id: 'extra', durationMinutes: 120 })],
    });

    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned[0]?.jobId).toBe('extra');
  });

  it('starts inside a hard customer arrival window', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [crew({ userId: 'alex' })],
      jobs: [
        job({
          id: 'after-school',
          durationMinutes: 90,
          arrivalWindow: { startMin: 15 * 60, endMin: 17 * 60 },
        }),
      ],
    });

    expect(plan.assignments[0]?.startMin).toBe(15 * 60);
    expect(plan.assignments[0]?.endMin).toBe(15 * 60 + 90);
  });

  it('rejects a commercial job when nobody has the required skill', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [crew({ userId: 'alex', skillTags: ['residential-deep'] })],
      jobs: [
        job({
          id: 'office',
          propertyKind: 'commercial',
          requiredSkillTags: ['floor-care'],
        }),
      ],
    });

    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned[0]?.reasons.join(' ')).toMatch(/skill/i);
  });

  it('assigns two people when the job requires a crew', () => {
    const plan = planOptimizedDay({
      policy: defaultScheduleOptimizerPolicy(),
      crew: [
        crew({ userId: 'alex', preferredPartnerIds: ['blair'] }),
        crew({ userId: 'blair' }),
        crew({ userId: 'casey' }),
      ],
      jobs: [
        job({
          id: 'office',
          propertyKind: 'commercial',
          requiredCrewSize: 2,
          durationMinutes: 180,
        }),
      ],
    });

    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments[0]?.userIds).toEqual(['alex', 'blair']);
  });

  it('spreads equal jobs across the team when workload balance is the deciding factor', () => {
    const policy = withWeights(defaultScheduleOptimizerPolicy(), {
      workload_balance: { weight: 100 },
    });
    const plan = planOptimizedDay({
      policy,
      crew: [crew({ userId: 'alex' }), crew({ userId: 'blair' })],
      jobs: [job({ id: 'a', durationMinutes: 60 }), job({ id: 'b', durationMinutes: 60 })],
    });

    const owners = plan.assignments.map((assignment) => assignment.userIds[0]);
    expect(owners.sort()).toEqual(['alex', 'blair']);
  });

  it('clusters two nearby stops on the cleaner who lives beside them', () => {
    const policy = withWeights(defaultScheduleOptimizerPolicy(), {
      workload_balance: { weight: 0 },
      travel_distance: { weight: 100 },
      zone_clustering: { weight: 80 },
    });
    const neighborhood = { lat: 26.72, lng: -81.76 };
    const plan = planOptimizedDay({
      policy,
      crew: [
        crew({ userId: 'local', home: neighborhood }),
        crew({ userId: 'remote', home: { lat: 27.95, lng: -82.46 } }),
      ],
      jobs: [
        job({
          id: 'first',
          durationMinutes: 90,
          location: neighborhood,
          zoneId: 'babcock',
          postalCode: '33982',
        }),
        job({
          id: 'second',
          durationMinutes: 90,
          location: { lat: 26.73, lng: -81.75 },
          zoneId: 'babcock',
          postalCode: '33982',
        }),
      ],
    });

    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments.every((assignment) => assignment.userIds[0] === 'local')).toBe(true);
    const ordered = [...plan.assignments].sort((a, b) => a.startMin - b.startMin);
    expect(ordered[1]!.startMin).toBeGreaterThan(ordered[0]!.endMin);
  });
});
