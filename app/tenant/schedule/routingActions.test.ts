import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  featureUpgradeMessage,
  type EntitlementFeature,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';

const harness = vi.hoisted(() => ({
  plan: 'starter' as EntitlementPlanKey,
  role: 'owner' as string | null,
  userId: 'actor-1' as string | null,
  slug: 'qa-commercial' as string | null,
  off: [] as EntitlementFeature[],
  dispatchCalls: 0,
  stopOrderCalls: 0,
  reportCalls: 0,
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-current',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthContext: async () => (harness.userId ? { user: { id: harness.userId } } : null),
}));

vi.mock('@/lib/portal', () => ({
  getPortalContext: async () => ({ tenantSlug: harness.slug }),
}));

vi.mock('@/lib/billing/entitlements', async () => {
  const actual = await vi.importActual('@/lib/billing/entitlements');
  const real = actual as {
    isFeatureEnabled: (plan: EntitlementPlanKey, feature: EntitlementFeature) => boolean;
  };
  return {
    ...(actual as object),
    resolveTenantEntitlementPlan: async () => harness.plan,
    resolveTenantRoutingPlan: async () => harness.plan,
    isFeatureEnabled: (plan: EntitlementPlanKey, feature: EntitlementFeature) => {
      if (harness.off.includes(feature)) return false;
      return real.isFeatureEnabled(plan, feature);
    },
  };
});

vi.mock('@/lib/routing/loadDispatchPlan', () => ({
  loadDispatchPlan: async () => {
    harness.dispatchCalls += 1;
    return null;
  },
}));

vi.mock('@/lib/routing/loadCleanerStopOrder', () => ({
  loadCleanerStopOrder: async () => {
    harness.stopOrderCalls += 1;
    return null;
  },
}));

vi.mock('@/lib/routing/loadDriveTimeReport', () => ({
  loadDriveTimeReport: async () => {
    harness.reportCalls += 1;
    return { rows: [] };
  },
}));

vi.mock('@/lib/routing/driveTimeReport', () => ({
  driveTimeReportCsv: () => 'date,cleaner\n',
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle: async () => {
          if (table === 'tenant_memberships') {
            return {
              data: harness.role ? { role: harness.role, user_id: 'cleaner-1' } : null,
              error: null,
            };
          }
          return { data: { timezone: 'America/New_York', display_name: 'Drew' }, error: null };
        },
      };
      return builder;
    },
  }),
}));

import { applyDispatchAction } from '@/app/tenant/schedule/dispatchActions';
import { applyStopOrderAction } from '@/app/tenant/schedule/stopOrderActions';
import { GET as exportDriveTime } from '@/app/tenant/schedule/drive-time/export/route';

function dispatchForm(mode?: string) {
  const data = new FormData();
  data.set('tenant_slug', 'acme');
  data.set('date_key', '2026-06-01');
  data.set('fingerprint', 'fp');
  data.set('plan_key', 'plan');
  if (mode) data.set('mode', mode);
  return data;
}

function stopForm() {
  const data = new FormData();
  data.set('tenant_slug', 'acme');
  data.set('date_key', '2026-06-01');
  data.set('cleaner_user_id', '11111111-1111-4111-8111-111111111111');
  return data;
}

describe('routing server actions', () => {
  beforeEach(() => {
    harness.plan = 'starter';
    harness.role = 'owner';
    harness.userId = 'actor-1';
    harness.slug = 'qa-commercial';
    harness.off = [];
    harness.dispatchCalls = 0;
    harness.stopOrderCalls = 0;
    harness.reportCalls = 0;
  });

  it('blocks Starter and trial dispatch before the engine', async () => {
    for (const plan of ['starter', 'trial'] as const) {
      harness.plan = plan;
      harness.dispatchCalls = 0;
      await expect(applyDispatchAction({}, dispatchForm())).resolves.toEqual({
        error: featureUpgradeMessage('multiCleanerDispatch'),
      });
      expect(harness.dispatchCalls).toBe(0);
    }
  });

  it('blocks re-optimize below Pro before the engine', async () => {
    for (const plan of ['starter', 'business', 'trial'] as const) {
      harness.plan = plan;
      harness.dispatchCalls = 0;
      await expect(applyDispatchAction({}, dispatchForm('reoptimize'))).resolves.toEqual({
        error: featureUpgradeMessage('routeReoptimization'),
      });
      expect(harness.dispatchCalls).toBe(0);
    }
  });

  it('lets Business build a dispatch and Pro build a re-optimize', async () => {
    harness.plan = 'business';
    await expect(applyDispatchAction({}, dispatchForm())).resolves.toEqual({
      error: 'Could not build the dispatch.',
    });
    expect(harness.dispatchCalls).toBe(1);

    harness.plan = 'pro';
    await expect(applyDispatchAction({}, dispatchForm('reoptimize'))).resolves.toEqual({
      error: 'Could not build the dispatch.',
    });
    expect(harness.dispatchCalls).toBe(2);
  });

  it('blocks a field employee before either engine', async () => {
    harness.role = 'employee';
    harness.plan = 'pro';
    await expect(applyDispatchAction({}, dispatchForm())).resolves.toEqual({
      error: 'Only the office can apply a dispatch.',
    });
    await expect(applyStopOrderAction({}, stopForm())).resolves.toEqual({
      error: 'Only the office can apply a stop order.',
    });
    expect(harness.dispatchCalls).toBe(0);
    expect(harness.stopOrderCalls).toBe(0);
  });

  it('blocks stop ordering when that flag is off and allows it on Starter', async () => {
    harness.off = ['singleCleanerStopOrdering'];
    await expect(applyStopOrderAction({}, stopForm())).resolves.toEqual({
      error: featureUpgradeMessage('singleCleanerStopOrdering'),
    });
    expect(harness.stopOrderCalls).toBe(0);

    harness.off = [];
    harness.plan = 'starter';
    await expect(applyStopOrderAction({}, stopForm())).resolves.toEqual({
      error: 'Stop order is not available yet.',
    });
    expect(harness.stopOrderCalls).toBe(1);
  });

  it('blocks drive-time export below Pro and allows it on Pro', async () => {
    for (const plan of ['starter', 'business', 'trial'] as const) {
      harness.plan = plan;
      harness.reportCalls = 0;
      const response = await exportDriveTime(
        new Request(
          'http://qa-commercial.lvh.me:3000/schedule/drive-time/export?from=2026-06-01&to=2026-06-02',
        ),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: featureUpgradeMessage('driveTimeReports') });
      expect(harness.reportCalls).toBe(0);
    }

    harness.plan = 'pro';
    const allowed = await exportDriveTime(
      new Request(
        'http://qa-pro.lvh.me:3000/schedule/drive-time/export?from=2026-06-01&to=2026-06-02',
      ),
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('date,cleaner');
    expect(harness.reportCalls).toBe(1);
  });

  it('rejects a drive-time export with no tenant', async () => {
    harness.slug = null;
    const response = await exportDriveTime(
      new Request('http://lvh.me:3000/schedule/drive-time/export'),
    );
    expect(response.status).toBe(401);
    expect(harness.reportCalls).toBe(0);
  });
});
