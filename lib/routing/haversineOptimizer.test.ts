import { describe, expect, it } from 'vitest';
import {
  createRouteOptimizer,
  formatStraightLineMiles,
  haversineNearestNeighborOrder,
  optimizeHaversine,
  straightLineMiles,
} from '@/lib/routing/haversineOptimizer';
import { canApplyStopOrder, hasFixedArrivalWindow, isVisitTimeLocked } from '@/lib/routing/locks';
import type { RouteOptimizeRequest, RouteStopInput } from '@/lib/routing/types';

function stop(
  id: string,
  lat: number,
  lng: number,
  lockedAt: number | null = null,
): RouteStopInput {
  return { id, point: { lat, lng }, lockedAt, missingReason: 'Missing map point' };
}

describe('haversine route optimizer', () => {
  it('returns the same order every time', async () => {
    const request: RouteOptimizeRequest = {
      start: { lat: 35.55, lng: -82.55 },
      stops: [
        stop('west', 35.5, -82.8),
        stop('locked', 35.6, -82.4, 2),
        stop('south', 35.4, -82.55),
        {
          id: 'cabin',
          point: null,
          lockedAt: null,
          missingReason: "Couldn't locate this address",
        },
      ],
    };
    const engine = createRouteOptimizer();
    const first = await engine.optimize(request);
    const second = await engine.optimize(request);
    expect(engine.engine).toBe('haversine');
    expect(second).toEqual(first);
    expect(first.estimateKind).toBe('straight-line');
    expect(first.unrouted).toEqual([{ id: 'cabin', reason: "Couldn't locate this address" }]);
    expect(first.orderedIds).not.toContain('cabin');
    expect(first.orderedIds).toEqual(['locked', 'south', 'west']);
  });

  it('keeps locked appointments in time order and moves flexible stops around them', () => {
    const request: RouteOptimizeRequest = {
      start: { lat: 0, lng: 0 },
      stops: [
        stop('late-near', 0, 0.01, 20),
        stop('flex', 0, 0, null),
        stop('early-far', 0, 1, 10),
      ],
    };
    const result = optimizeHaversine(request);
    expect(result.orderedIds.indexOf('early-far')).toBeLessThan(
      result.orderedIds.indexOf('late-near'),
    );
    expect(result.orderedIds[0]).toBe('flex');
    const [late, flex, early] = request.stops;
    if (!late || !flex || !early) throw new Error('fixture');
    const shuffled = optimizeHaversine({
      ...request,
      stops: [early, late, flex],
    });
    expect(shuffled.orderedIds.indexOf('early-far')).toBeLessThan(
      shuffled.orderedIds.indexOf('late-near'),
    );
  });

  it('leaves a fully locked day in appointment order', () => {
    const request: RouteOptimizeRequest = {
      start: { lat: 0, lng: 0 },
      stops: [stop('c', 0, 0.01, 30), stop('a', 0, 5, 10), stop('b', 0, 4, 20)],
    };
    expect(optimizeHaversine(request).orderedIds).toEqual(['a', 'b', 'c']);
  });

  it('drops ungeocoded and invalid points', () => {
    const request: RouteOptimizeRequest = {
      start: null,
      stops: [
        stop('ok', 35.5, -82.5),
        { id: 'retry', point: null, lockedAt: null, missingReason: 'Lookup will retry' },
        {
          id: 'bad',
          point: { lat: 120, lng: -82 },
          lockedAt: null,
          missingReason: 'Missing map point',
        },
      ],
    };
    const result = optimizeHaversine(request);
    expect(result.orderedIds).toEqual(['ok']);
    expect(result.unrouted).toEqual([
      { id: 'retry', reason: 'Lookup will retry' },
      { id: 'bad', reason: 'Missing map point' },
    ]);
  });

  it('never lets 2-opt make the straight-line path longer than nearest-neighbor', () => {
    const sets: RouteOptimizeRequest[] = [
      {
        start: { lat: 0, lng: 0 },
        stops: [
          stop('a', 0, 1),
          stop('b', 1, 1),
          stop('c', 0, 2),
          stop('d', 1, 0),
          stop('e', 2, 2),
          stop('f', 0.2, 1.6),
        ],
      },
      {
        start: { lat: 35.55, lng: -82.55 },
        stops: [
          stop('west', 35.5, -82.8),
          stop('locked', 35.6, -82.4, 2),
          stop('south', 35.4, -82.55),
          stop('north', 35.7, -82.5),
        ],
      },
      {
        start: null,
        stops: [stop('p', 1, 1), stop('q', 1, 2), stop('r', 2, 1, 5), stop('s', 3, 0)],
      },
    ];

    for (const request of sets) {
      const optimized = optimizeHaversine(request);
      const seeded = haversineNearestNeighborOrder(request);
      const after = straightLineMiles(request, optimized.orderedIds);
      const beforeSeed = straightLineMiles(request, seeded);
      expect(after).toBeLessThanOrEqual(beforeSeed + 1e-6);
      expect(optimized.estimatedMilesAfter).toBeLessThanOrEqual(
        optimized.estimatedMilesBefore + 1e-6,
      );
      expect(optimized.estimatedMilesAfter).toBeCloseTo(after, 6);
    }
  });

  it('uses 2-opt to shorten a nearest-neighbor path that crosses itself', () => {
    const request: RouteOptimizeRequest = {
      start: { lat: 0.6, lng: -0.4 },
      stops: [stop('a', 0, 0), stop('b', 0, 1), stop('c', 1, 0), stop('d', 1, 1), stop('e', 2, 0)],
    };
    const seeded = haversineNearestNeighborOrder(request);
    const optimized = optimizeHaversine(request);
    const seededMiles = straightLineMiles(request, seeded);
    const optimizedMiles = straightLineMiles(request, optimized.orderedIds);
    expect(seeded).toEqual(['c', 'd', 'b', 'a', 'e']);
    expect(optimized.orderedIds).toEqual(['a', 'b', 'd', 'c', 'e']);
    expect(optimizedMiles).toBeLessThan(seededMiles - 1);
  });

  it('starts at the first routed stop when the office has no point', () => {
    const request: RouteOptimizeRequest = {
      start: null,
      stops: [stop('first', 10, 10), stop('second', 10.1, 10), stop('third', 11, 10)],
    };
    expect(optimizeHaversine(request).orderedIds[0]).toBe('first');
  });

  it('formats miles to one decimal', () => {
    expect(formatStraightLineMiles(1.24)).toBe('1.2');
    expect(formatStraightLineMiles(1.25)).toBe('1.3');
  });
});

describe('stop order locks and roles', () => {
  it('locks a specific arrival window and leaves a time-of-day preference flexible', () => {
    expect(
      hasFixedArrivalWindow({
        arrivalStart: '09:00',
        arrivalEnd: '10:00',
        schedulingOverride: null,
      }),
    ).toBe(true);
    expect(
      hasFixedArrivalWindow({
        arrivalStart: null,
        arrivalEnd: null,
        schedulingOverride: { arrivalStart: '11:00', arrivalEnd: '12:00' },
      }),
    ).toBe(true);
    expect(
      hasFixedArrivalWindow({
        arrivalStart: null,
        arrivalEnd: null,
        schedulingOverride: { preferredTimeWindow: 'morning' },
      }),
    ).toBe(false);
    expect(
      isVisitTimeLocked({
        status: 'scheduled',
        checkedInAt: null,
        visitPurpose: 'service',
        hasFixedArrivalWindow: false,
      }),
    ).toBe(false);
    expect(
      isVisitTimeLocked({
        status: 'scheduled',
        checkedInAt: null,
        visitPurpose: 'consultation',
        hasFixedArrivalWindow: false,
      }),
    ).toBe(true);
    expect(
      isVisitTimeLocked({
        status: 'completed',
        checkedInAt: null,
        visitPurpose: 'service',
        hasFixedArrivalWindow: false,
      }),
    ).toBe(true);
  });

  it('lets only the office apply a stop order', () => {
    expect(canApplyStopOrder('owner')).toBe(true);
    expect(canApplyStopOrder('admin')).toBe(true);
    expect(canApplyStopOrder('employee')).toBe(false);
    expect(canApplyStopOrder('viewer')).toBe(false);
  });
});
