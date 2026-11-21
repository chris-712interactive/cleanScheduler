import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntitlementPlanKey, RoutingEntitlementFeature } from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';

const harness = vi.hoisted(() => ({
  blockStopOrder: false,
  optimizeCalls: 0,
}));

vi.mock('@/lib/billing/entitlements', async () => {
  const actual = await vi.importActual('@/lib/billing/entitlements');
  const real = actual as {
    routingFeaturesForPlan: (
      plan: EntitlementPlanKey,
    ) => Record<RoutingEntitlementFeature, boolean>;
  };
  return {
    ...(actual as object),
    routingFeaturesForPlan: (plan: EntitlementPlanKey) => {
      const features = real.routingFeaturesForPlan(plan);
      if (!harness.blockStopOrder) return features;
      return { ...features, singleCleanerStopOrdering: false };
    },
  };
});

vi.mock('@/lib/schedule/loadDayMap', () => ({
  loadDayMapRows: async () => ({ rows: [], routeSequenceAvailable: true }),
}));

vi.mock('@/lib/routing/createRouteOptimizer', () => ({
  createRouteOptimizer: () => ({
    optimize: async () => {
      harness.optimizeCalls += 1;
      return {
        orderedIds: [],
        unrouted: [],
        estimateKind: 'straight-line',
        estimatedMilesBefore: 0,
        estimatedMilesAfter: 0,
        driveSecondsBefore: null,
        driveSecondsAfter: null,
      };
    },
  }),
}));

vi.mock('@/lib/routing/fleetOptimizer', () => ({
  createFleetOptimizer: () => ({
    optimize: async () => {
      harness.optimizeCalls += 1;
      throw new Error('dispatch engine should not run');
    },
  }),
}));

import { loadCleanerStopOrder } from '@/lib/routing/loadCleanerStopOrder';
import { loadDispatchPlan } from '@/lib/routing/loadDispatchPlan';

function countingClient(tables: string[]) {
  return {
    from(table: string) {
      tables.push(table);
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return builder;
        },
        maybeSingle: async () => ({ data: { latitude: 35.5, longitude: -82.5 }, error: null }),
        then(resolve: (value: unknown) => void) {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

const cleanerId = '11111111-1111-4111-8111-111111111111';

describe('routing engine gates', () => {
  beforeEach(() => {
    harness.blockStopOrder = false;
    harness.optimizeCalls = 0;
  });

  it('does not call the dispatch engine for Starter or the trial', async () => {
    for (const plan of ['starter', 'trial'] as const) {
      const tables: string[] = [];
      await expect(
        loadDispatchPlan({
          supabase: countingClient(tables),
          tenantId: 'tenant-1',
          dateKey: '2026-06-01',
          timeZone: 'America/New_York',
          plan,
        }),
      ).resolves.toBeNull();
      expect(tables).toEqual([]);
    }
    expect(harness.optimizeCalls).toBe(0);
  });

  it('does not call the stop-order engine when that flag is off', async () => {
    harness.blockStopOrder = true;
    const tables: string[] = [];
    await expect(
      loadCleanerStopOrder({
        supabase: countingClient(tables),
        tenantId: 'tenant-1',
        dateKey: '2026-06-01',
        timeZone: 'America/New_York',
        cleanerUserId: cleanerId,
        cleanerName: 'Drew',
        plan: 'starter',
      }),
    ).resolves.toBeNull();
    expect(tables).toEqual([]);
    expect(harness.optimizeCalls).toBe(0);
  });

  it('orders a Starter day from the office and does not read Pro start locations', async () => {
    const tables: string[] = [];
    const view = await loadCleanerStopOrder({
      supabase: countingClient(tables),
      tenantId: 'tenant-1',
      dateKey: '2026-06-01',
      timeZone: 'America/New_York',
      cleanerUserId: cleanerId,
      cleanerName: 'Drew',
      plan: 'starter',
    });
    expect(view?.startLabel).toBe('Office');
    expect(tables).not.toContain('tenant_cleaner_route_bases');
    expect(tables).not.toContain('tenant_route_locations');
    expect(tables).not.toContain('tenant_member_scheduling_profiles');
    expect(harness.optimizeCalls).toBe(1);
  });
});
