import { describe, expect, it } from 'vitest';
import { planDispatchHaversine } from '@/lib/routing/dispatchPlan';
import { optimizeHaversine } from '@/lib/routing/haversineOptimizer';
import { resolveCleanerBase } from '@/lib/routing/routeBases';
import type { DispatchPlanRequest } from '@/lib/routing/dispatchPlan';

describe('cleaner start and end', () => {
  it('uses a home start and a saved end, and falls back to the office', () => {
    const home = resolveCleanerBase({
      userId: 'ada',
      serviceDate: '2026-11-20',
      office: { lat: 35.55, lng: -82.55 },
      home: { lat: 35.5, lng: -82.8 },
      locations: [{ id: 'barn', label: 'North barn', point: { lat: 35.7, lng: -82.5 } }],
      bases: [
        {
          userId: 'ada',
          serviceDate: null,
          startKind: 'home',
          startLocationId: null,
          endKind: 'location',
          endLocationId: 'barn',
        },
        {
          userId: 'ada',
          serviceDate: '2026-11-20',
          startKind: 'location',
          startLocationId: 'barn',
          endKind: 'same',
          endLocationId: null,
        },
      ],
    });
    expect(home.startLabel).toBe('North barn');
    expect(home.start).toEqual({ lat: 35.7, lng: -82.5 });
    expect(home.endLabel).toBe('North barn');

    const office = resolveCleanerBase({
      userId: 'bea',
      serviceDate: '2026-11-20',
      office: { lat: 1, lng: 2 },
      home: null,
      locations: [],
      bases: [],
    });
    expect(office).toMatchObject({ start: null, end: null, startLabel: 'Office' });
  });

  it('orders and assigns from each cleaner start and counts the return', () => {
    const request: DispatchPlanRequest = {
      office: { lat: 0, lng: 0 },
      cleaners: [
        {
          id: 'ada',
          shiftStartSec: 0,
          shiftEndSec: 86_400,
          timeOff: [],
          start: { lat: 0, lng: -1 },
          end: { lat: 1, lng: -1 },
        },
        {
          id: 'bea',
          shiftStartSec: 0,
          shiftEndSec: 86_400,
          timeOff: [],
          start: { lat: 0, lng: 1 },
        },
      ],
      visits: [
        {
          id: 'west',
          point: { lat: 0, lng: -1 },
          missingReason: 'Missing map point',
          pinned: false,
          lockedAt: null,
          startSec: 10 * 3600,
          endSec: 11 * 3600,
          assigneeIds: [],
          requiredCleanerIds: [],
          blockedCleanerIds: [],
        },
        {
          id: 'east',
          point: { lat: 0, lng: 1 },
          missingReason: 'Missing map point',
          pinned: false,
          lockedAt: null,
          startSec: 12 * 3600,
          endSec: 13 * 3600,
          assigneeIds: [],
          requiredCleanerIds: [],
          blockedCleanerIds: [],
        },
      ],
    };
    const plan = planDispatchHaversine(request);
    expect(plan.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual(['west']);
    expect(plan.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual(['east']);
    const adaMiles = plan.assignments.find((row) => row.cleanerId === 'ada')?.estimatedMiles ?? 0;
    const withoutReturn = planDispatchHaversine({
      ...request,
      cleaners: request.cleaners.map((cleaner) => ({ ...cleaner, end: null })),
    }).assignments.find((row) => row.cleanerId === 'ada')?.estimatedMiles;
    expect(adaMiles).toBeGreaterThan(withoutReturn ?? 0);

    const ordered = optimizeHaversine({
      start: { lat: 0, lng: 0 },
      end: { lat: 1, lng: 0 },
      stops: [
        { id: 'a', point: { lat: 0, lng: 1 }, lockedAt: null, missingReason: 'Missing map point' },
        { id: 'b', point: { lat: 0, lng: 2 }, lockedAt: null, missingReason: 'Missing map point' },
      ],
    });
    const open = optimizeHaversine({
      start: { lat: 0, lng: 0 },
      stops: [
        { id: 'a', point: { lat: 0, lng: 1 }, lockedAt: null, missingReason: 'Missing map point' },
        { id: 'b', point: { lat: 0, lng: 2 }, lockedAt: null, missingReason: 'Missing map point' },
      ],
    });
    expect(ordered.estimateKind).toBe('straight-line');
    expect(ordered.estimatedMilesAfter).toBeGreaterThan(open.estimatedMilesAfter);
  });
});
