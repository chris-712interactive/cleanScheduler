import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DISPATCH_CLEANER_OFF,
  DISPATCH_NO_CLEANER,
  DISPATCH_OUTSIDE_HOURS,
  planDispatchHaversine,
} from '@/lib/routing/dispatchPlan';
import { NO_ROAD_ROUTE_REASON } from '@/lib/routing/engineOptimizer';
import { createFleetOptimizer, FleetRouteOptimizer } from '@/lib/routing/fleetOptimizer';
import type { DispatchPlanRequest } from '@/lib/routing/dispatchPlan';

const TOKEN = 'test-token-value';
const BASE = 'https://routing.example.test';

function enableEngine(): void {
  vi.stubEnv('ROUTING_ENGINE_URL', BASE);
  vi.stubEnv('ROUTING_ENGINE_TOKEN', TOKEN);
  vi.stubEnv('OUTBOUND_SUPPRESSED', '');
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'localhost');
}

function squareMatrix(
  size: number,
  missing: number[] = [],
): {
  sources_to_targets: Array<Array<{ distance: number | null; time: number | null }>>;
} {
  const gone = new Set(missing);
  return {
    sources_to_targets: Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => {
        if (row === column) return { distance: 0, time: 0 };
        if (gone.has(row) || gone.has(column)) return { distance: null, time: null };
        return { distance: 2, time: 120 };
      }),
    ),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const request: DispatchPlanRequest = {
  office: { lat: 35.55, lng: -82.55 },
  cleaners: [
    { id: 'ada', shiftStartSec: 8 * 3600, shiftEndSec: 17 * 3600, timeOff: [] },
    { id: 'bea', shiftStartSec: 8 * 3600, shiftEndSec: 17 * 3600, timeOff: [] },
  ],
  visits: [
    {
      id: 'locked',
      point: { lat: 35.6, lng: -82.4 },
      missingReason: 'Missing map point',
      pinned: true,
      lockedAt: 1,
      startSec: 9 * 3600,
      endSec: 10 * 3600,
      assigneeIds: ['ada'],
      requiredCleanerIds: [],
      blockedCleanerIds: [],
    },
    {
      id: 'west',
      point: { lat: 35.5, lng: -82.8 },
      missingReason: 'Missing map point',
      pinned: false,
      lockedAt: null,
      startSec: 11 * 3600,
      endSec: 12 * 3600,
      assigneeIds: [],
      requiredCleanerIds: [],
      blockedCleanerIds: [],
    },
    {
      id: 'south',
      point: { lat: 35.4, lng: -82.55 },
      missingReason: 'Missing map point',
      pinned: false,
      lockedAt: null,
      startSec: 13 * 3600,
      endSec: 14 * 3600,
      assigneeIds: [],
      requiredCleanerIds: [],
      blockedCleanerIds: [],
    },
  ],
};

describe('fleet routing engine', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends one auto solve with a vehicle per cleaner', async () => {
    enableEngine();
    const captured: {
      body: {
        vehicles: Array<{ id: number; profile: string; start_index: number }>;
        jobs: unknown[];
        matrices: { auto: { durations: number[][] } };
      } | null;
    } = { body: null };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        const body = JSON.parse(String(init?.body)) as {
          costing: string;
          units: string;
          sources: unknown[];
        };
        expect(body).toMatchObject({ costing: 'auto', units: 'miles' });
        return jsonResponse(squareMatrix(body.sources.length));
      }
      captured.body = JSON.parse(String(init?.body));
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          {
            vehicle: 1,
            steps: [{ type: 'start' }, { type: 'job', id: 1 }, { type: 'job', id: 2 }],
          },
          {
            vehicle: 2,
            steps: [{ type: 'start' }, { type: 'job', id: 3 }],
          },
        ],
      });
    });

    const result = await new FleetRouteOptimizer({ fetchImpl }).optimize(request);
    expect(result.estimateKind).toBe('drive');
    const solvedBody = captured.body;
    if (!solvedBody) throw new Error('missing solve');
    expect(solvedBody.vehicles.map((vehicle) => vehicle.profile)).toEqual(['auto', 'auto']);
    expect(solvedBody.vehicles.every((vehicle) => vehicle.start_index === 0)).toBe(true);
    expect(solvedBody.matrices.auto.durations[0]?.[1]).toBe(120);
    expect(result.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual([
      'locked',
      'west',
    ]);
    expect(result.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual([
      'south',
    ]);
    expect(result.assignments.find((row) => row.cleanerId === 'ada')?.driveSeconds).toBeGreaterThan(
      0,
    );
    const locked = result.visits.find((row) => row.id === 'locked');
    expect(locked).toMatchObject({
      changeAssignees: false,
      assigneeIds: ['ada'],
      routeSequence: 1,
    });
    const south = result.visits.find((row) => row.id === 'south');
    expect(south).toMatchObject({ changeAssignees: true, assigneeIds: ['bea'] });
  });

  it('keeps a stop with no road off the solve and still routes the others', async () => {
    enableEngine();
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        const body = JSON.parse(String(init?.body)) as { sources: unknown[] };
        return jsonResponse(squareMatrix(body.sources.length, [3]));
      }
      const body = JSON.parse(String(init?.body)) as { jobs: Array<{ id: number }> };
      expect(body.jobs.map((job) => job.id)).toEqual([1, 2]);
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          { vehicle: 1, steps: [{ type: 'start' }, { type: 'job', id: 1 }] },
          { vehicle: 2, steps: [{ type: 'start' }, { type: 'job', id: 2 }] },
        ],
      });
    });
    const result = await new FleetRouteOptimizer({ fetchImpl }).optimize(request);
    expect(result.estimateKind).toBe('drive');
    expect(result.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual([
      'locked',
    ]);
    expect(result.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual(['west']);
    expect(result.unassigned).toEqual([{ id: 'south', reason: NO_ROAD_ROUTE_REASON }]);
    expect(result.visits.find((row) => row.id === 'south')).toMatchObject({
      changeAssignees: true,
      assigneeIds: [],
      routeSequence: null,
    });
  });

  it('uses the straight-line plan when the engine is unset, suppressed, or unassigned', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
    const plain = await createFleetOptimizer().optimize(request);
    expect(plain).toEqual(planDispatchHaversine(request));
    expect(plain.estimateKind).toBe('straight-line');

    enableEngine();
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    const suppressed = await new FleetRouteOptimizer({
      fetchImpl: vi.fn(() => {
        throw new Error('should not fetch');
      }),
    }).optimize(request);
    expect(suppressed.estimateKind).toBe('straight-line');
    expect(logs.join('\n')).toContain('operation=dispatch');
    expect(logs.join('\n')).not.toContain(TOKEN);

    vi.stubEnv('OUTBOUND_SUPPRESSED', '');
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(squareMatrix(4));
      }
      return jsonResponse({
        code: 0,
        unassigned: [{ id: 1 }],
        routes: [],
      });
    });
    const fallback = await new FleetRouteOptimizer({ fetchImpl }).optimize(request);
    expect(fallback).toEqual(planDispatchHaversine(request));
    expect(logs.join('\n')).toContain('reason=unassigned');
  });

  it('does not keep a visit that the engine put on a blocked cleaner', async () => {
    enableEngine();
    const blocked: DispatchPlanRequest = {
      office: { lat: 0, lng: 0 },
      cleaners: [
        { id: 'ada', shiftStartSec: 8 * 3600, shiftEndSec: 17 * 3600, timeOff: [] },
        { id: 'bea', shiftStartSec: 8 * 3600, shiftEndSec: 17 * 3600, timeOff: [] },
      ],
      visits: [
        {
          id: 'west',
          point: { lat: 1, lng: 1 },
          missingReason: 'Missing map point',
          pinned: false,
          lockedAt: null,
          startSec: 10 * 3600,
          endSec: 11 * 3600,
          assigneeIds: [],
          requiredCleanerIds: [],
          blockedCleanerIds: ['ada'],
        },
      ],
    };
    const captured: { skills: number[] | null } = { skills: null };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(squareMatrix(2));
      }
      const body = JSON.parse(String(init?.body)) as {
        jobs: Array<{ skills?: number[] }>;
      };
      captured.skills = body.jobs[0]?.skills ?? null;
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          { vehicle: 1, steps: [{ type: 'start' }, { type: 'job', id: 1 }] },
          { vehicle: 2, steps: [{ type: 'start' }] },
        ],
      });
    });

    const result = await new FleetRouteOptimizer({ fetchImpl }).optimize(blocked);
    expect(captured.skills).toEqual([2]);
    expect(result.assignments.find((row) => row.cleanerId === 'ada')?.orderedIds).toEqual([]);
    expect(result.assignments.find((row) => row.cleanerId === 'bea')?.orderedIds).toEqual([]);
    expect(result.unassigned).toEqual([{ id: 'west', reason: DISPATCH_NO_CLEANER }]);
    expect(result.visits.find((row) => row.id === 'west')).toMatchObject({
      changeAssignees: true,
      assigneeIds: [],
    });
  });

  it('keeps the rest of a time-off block when a pinned visit covers only the start', async () => {
    enableEngine();
    const day: DispatchPlanRequest = {
      office: { lat: 0, lng: 0 },
      cleaners: [
        {
          id: 'ada',
          shiftStartSec: 8 * 3600,
          shiftEndSec: 17 * 3600,
          timeOff: [{ startSec: 9 * 3600, endSec: 12 * 3600 }],
        },
      ],
      visits: [
        {
          id: 'pinned',
          point: { lat: 1, lng: 1 },
          missingReason: 'Missing map point',
          pinned: true,
          lockedAt: 1,
          startSec: 9 * 3600,
          endSec: 10 * 3600,
          assigneeIds: ['ada'],
          requiredCleanerIds: [],
          blockedCleanerIds: [],
        },
        {
          id: 'later',
          point: { lat: 1.1, lng: 1.1 },
          missingReason: 'Missing map point',
          pinned: false,
          lockedAt: null,
          startSec: 10 * 3600 + 30 * 60,
          endSec: 11 * 3600 + 30 * 60,
          assigneeIds: [],
          requiredCleanerIds: [],
          blockedCleanerIds: [],
        },
      ],
    };
    const captured: {
      breaks: Array<{ service: number; time_windows: Array<[number, number]> }> | null;
    } = { breaks: null };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(squareMatrix(3));
      }
      const body = JSON.parse(String(init?.body)) as {
        vehicles: Array<{
          breaks?: Array<{ service: number; time_windows: Array<[number, number]> }>;
        }>;
      };
      captured.breaks = body.vehicles[0]?.breaks ?? null;
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          {
            vehicle: 1,
            steps: [{ type: 'start' }, { type: 'job', id: 1 }, { type: 'job', id: 2 }],
          },
        ],
      });
    });

    const result = await new FleetRouteOptimizer({ fetchImpl }).optimize(day);
    expect(captured.breaks).toEqual([
      { id: 1, service: 2 * 3600, time_windows: [[10 * 3600, 10 * 3600]] },
    ]);
    expect(result.assignments[0]?.orderedIds).toEqual(['pinned']);
    expect(result.unassigned).toEqual([{ id: 'later', reason: DISPATCH_CLEANER_OFF }]);
    expect(result.visits.find((row) => row.id === 'later')).toMatchObject({
      changeAssignees: true,
      assigneeIds: [],
    });
  });

  it('drops a flexible visit the engine scheduled outside the shift', async () => {
    enableEngine();
    const day: DispatchPlanRequest = {
      office: { lat: 0, lng: 0 },
      cleaners: [{ id: 'ada', shiftStartSec: 8 * 3600, shiftEndSec: 12 * 3600, timeOff: [] }],
      visits: [
        {
          id: 'late',
          point: { lat: 1, lng: 1 },
          missingReason: 'Missing map point',
          pinned: false,
          lockedAt: null,
          startSec: 15 * 3600,
          endSec: 16 * 3600,
          assigneeIds: [],
          requiredCleanerIds: [],
          blockedCleanerIds: [],
        },
      ],
    };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(squareMatrix(2));
      }
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [{ vehicle: 1, steps: [{ type: 'start' }, { type: 'job', id: 1 }] }],
      });
    });
    const result = await new FleetRouteOptimizer({ fetchImpl }).optimize(day);
    expect(result.assignments[0]?.orderedIds).toEqual([]);
    expect(result.unassigned).toEqual([{ id: 'late', reason: DISPATCH_OUTSIDE_HOURS }]);
  });
});
