import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouteOptimizer } from '@/lib/routing/createRouteOptimizer';
import { EngineRouteOptimizer, NO_ROAD_ROUTE_REASON } from '@/lib/routing/engineOptimizer';
import { optimizeHaversine } from '@/lib/routing/haversineOptimizer';
import type { RouteOptimizeRequest, RouteStopInput } from '@/lib/routing/types';

const TOKEN = 'test-token-value';
const BASE = 'https://routing.example.test';

function stop(
  id: string,
  lat: number,
  lng: number,
  lockedAt: number | null = null,
): RouteStopInput {
  return { id, point: { lat, lng }, lockedAt, missingReason: 'Missing map point' };
}

function enableEngine(): void {
  vi.stubEnv('ROUTING_ENGINE_URL', BASE);
  vi.stubEnv('ROUTING_ENGINE_TOKEN', TOKEN);
  vi.stubEnv('OUTBOUND_SUPPRESSED', '');
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'localhost');
}

function squareMatrix(miles: number[][]): {
  sources_to_targets: Array<Array<{ distance: number | null; time: number | null }>>;
} {
  return {
    sources_to_targets: miles.map((row, rowIndex) =>
      row.map((distance, column) => {
        if (rowIndex === column) return { distance: 0, time: 0 };
        if (!Number.isFinite(distance)) return { distance: null, time: null };
        return { distance, time: distance * 60 };
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

const line = {
  start: { lat: 0, lng: 0 },
  stops: [stop('a', 0, 1), stop('b', 0, 2), stop('c', 0, 3)],
} satisfies RouteOptimizeRequest;

const lineMiles = [
  [0, 1, 5, 9],
  [1, 0, 1, 4],
  [5, 1, 0, 1],
  [9, 4, 1, 0],
];

describe('valhalla and vroom route optimizer', () => {
  const logs: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    logs.length = 0;
  });

  function spyLogs(): void {
    vi.spyOn(console, 'info').mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
  }

  it('uses the road matrix order and drive miles when the engine answers', async () => {
    enableEngine();
    spyLogs();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(squareMatrix(lineMiles));
      }
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          {
            steps: [
              { type: 'start' },
              { type: 'job', id: 3 },
              { type: 'job', id: 2 },
              { type: 'job', id: 1 },
            ],
          },
        ],
      });
    });

    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize(line);
    expect(result.estimateKind).toBe('drive');
    expect(result.orderedIds).toEqual(['c', 'b', 'a']);
    expect(result.orderedIds).not.toEqual(optimizeHaversine(line).orderedIds);
    expect(result.estimatedMilesBefore).toBeCloseTo(3, 6);
    expect(result.estimatedMilesAfter).toBeCloseTo(11, 6);
    expect(result.driveSecondsBefore).toBeCloseTo(180, 6);
    expect(result.driveSecondsAfter).toBeCloseTo(660, 6);
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/valhalla/sources_to_targets`,
      `${BASE}/vroom/`,
    ]);
    for (const call of calls) {
      expect(call.init.method).toBe('POST');
      expect(new Headers(call.init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
      expect(String(call.init.body)).not.toContain(TOKEN);
    }
    const solved = JSON.parse(String(calls[1]?.init.body)) as {
      vehicles: Array<{ profile: string; start_index: number; end_index?: number }>;
      jobs: Array<{ id: number; location_index: number }>;
      matrices: { auto: { durations: number[][]; distances: number[][] } };
    };
    expect(solved.vehicles).toEqual([{ id: 1, profile: 'auto', start_index: 0 }]);
    expect(solved.jobs.map((job) => job.location_index)).toEqual([1, 2, 3]);
    const matrixBody = JSON.parse(String(calls[0]?.init.body)) as {
      sources: Array<{ lat: number; lon: number }>;
      costing: string;
      units: string;
    };
    expect(matrixBody).toMatchObject({ costing: 'auto', units: 'miles' });
    expect(matrixBody.sources[0]).toEqual({ lat: 0, lon: 0 });
    expect(matrixBody.sources).toHaveLength(4);
    expect(solved.matrices.auto.durations[0]?.[1]).toBe(60);
    expect(solved.matrices.auto.distances[0]?.[1]).toBe(Math.round(1 * 1609.344));
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(createRouteOptimizer().engine).toBe('valhalla-vroom');
  });

  it('sends locked stops in time-window order and leaves ungeocoded stops off the matrix', async () => {
    enableEngine();
    const request: RouteOptimizeRequest = {
      start: { lat: 35.55, lng: -82.55 },
      stops: [
        stop('west', 35.5, -82.8),
        stop('locked-later', 35.6, -82.4, 20),
        stop('locked-sooner', 35.4, -82.55, 5),
        {
          id: 'cabin',
          point: null,
          lockedAt: null,
          missingReason: "Couldn't locate this address",
        },
      ],
    };
    let jobWindows: Array<{ id: number; time_windows?: Array<[number, number]> }> = [];
    let sourceCount = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        const body = JSON.parse(String(init?.body)) as { sources: unknown[] };
        sourceCount = body.sources.length;
        const miles = Array.from({ length: sourceCount }, () => Array(sourceCount).fill(2));
        return jsonResponse(squareMatrix(miles));
      }
      const body = JSON.parse(String(init?.body)) as {
        jobs: Array<{ id: number; time_windows?: Array<[number, number]> }>;
      };
      jobWindows = body.jobs;
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [
          {
            steps: [
              { type: 'start' },
              { type: 'job', id: 3 },
              { type: 'job', id: 1 },
              { type: 'job', id: 2 },
            ],
          },
        ],
      });
    });

    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize(request);
    expect(sourceCount).toBe(4);
    expect(result.unrouted).toEqual([{ id: 'cabin', reason: "Couldn't locate this address" }]);
    const sooner = jobWindows.find((job) => job.id === 3);
    const later = jobWindows.find((job) => job.id === 2);
    expect(sooner?.time_windows?.[0]?.[0]).toBeLessThan(later?.time_windows?.[0]?.[0] ?? 0);
    expect(result.orderedIds).toEqual(['locked-sooner', 'west', 'locked-later']);
  });

  it('keeps a drive result for the stops the road network can reach', async () => {
    enableEngine();
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/valhalla/sources_to_targets')) {
        return jsonResponse(
          squareMatrix([
            [0, 2, Number.NaN],
            [2, 0, Number.NaN],
            [Number.NaN, Number.NaN, 0],
          ]),
        );
      }
      const body = JSON.parse(String(init?.body)) as { jobs: unknown[] };
      expect(body.jobs).toHaveLength(1);
      return jsonResponse({
        code: 0,
        unassigned: [],
        routes: [{ steps: [{ type: 'start' }, { type: 'job', id: 1 }] }],
      });
    });

    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize({
      start: { lat: 0, lng: 0 },
      stops: [stop('near', 1, 1), stop('off-road', 2, 2)],
    });
    expect(result.estimateKind).toBe('drive');
    expect(result.orderedIds).toEqual(['near']);
    expect(result.estimatedMilesAfter).toBeCloseTo(2, 6);
    expect(result.driveSecondsAfter).toBeCloseTo(120, 6);
    expect(result.unrouted).toEqual([{ id: 'off-road', reason: NO_ROAD_ROUTE_REASON }]);
  });

  it('falls back when the engine times out', async () => {
    enableEngine();
    spyLogs();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const fail = () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
        if (init?.signal?.aborted) {
          fail();
          return;
        }
        init?.signal?.addEventListener('abort', fail, { once: true });
      });
    });
    const result = await new EngineRouteOptimizer({ fetchImpl, timeoutMs: 20 }).optimize(line);
    expect(result).toEqual(optimizeHaversine(line));
    expect(result.estimateKind).toBe('straight-line');
    expect(fetchImpl).toHaveBeenCalled();
    expect(logs.some((line) => line.includes('reason=timeout'))).toBe(true);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('falls back when the engine returns an error and does not log the token', async () => {
    enableEngine();
    spyLogs();
    const fetchImpl = vi.fn(async () => {
      throw new Error(`connect failed ${TOKEN} ${BASE}/valhalla/sources_to_targets`);
    });
    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize(line);
    expect(result).toEqual(optimizeHaversine(line));
    const text = logs.join('\n');
    expect(text).toContain('reason=error');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(BASE);
    expect(text).not.toContain('valhalla');
  });

  it('falls back without a socket when outbound calls are suppressed', async () => {
    enableEngine();
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    spyLogs();
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize(line);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual(optimizeHaversine(line));
    const text = logs.join('\n');
    expect(text).toContain('suppressed provider=routing operation=optimize');
    expect(text).toContain('reason=suppressed');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(BASE);
  });

  it('rejects a non-local http URL and does not call it', async () => {
    enableEngine();
    vi.stubEnv('ROUTING_ENGINE_URL', 'http://routing.example.test');
    spyLogs();
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const result = await new EngineRouteOptimizer({ fetchImpl }).optimize(line);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.estimateKind).toBe('straight-line');
    expect(logs.some((entry) => entry.includes('reason=invalid-config'))).toBe(true);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });
});
