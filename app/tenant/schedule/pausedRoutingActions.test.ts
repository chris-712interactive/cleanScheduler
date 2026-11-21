import { beforeEach, describe, expect, it, vi } from 'vitest';
import { featureUpgradeMessage } from '@/lib/billing/entitlements';

const harness = vi.hoisted(() => ({
  billing: {
    status: 'active',
    platform_plan: 'pro',
    stripe_subscription_status: 'paused',
  } as {
    status: string;
    platform_plan: string | null;
    stripe_subscription_status: string | null;
  } | null,
  dispatchCalls: 0,
  reportCalls: 0,
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-paused',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthContext: async () => ({ user: { id: 'actor-1' } }),
}));

vi.mock('@/lib/portal', () => ({
  getPortalContext: async () => ({ tenantSlug: 'qa-pro' }),
}));

vi.mock('@/lib/routing/loadDispatchPlan', () => ({
  loadDispatchPlan: async () => {
    harness.dispatchCalls += 1;
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
          if (table === 'tenant_billing_accounts') {
            return { data: harness.billing, error: null };
          }
          if (table === 'tenant_memberships') {
            return { data: { role: 'owner', user_id: 'cleaner-1' }, error: null };
          }
          return { data: { timezone: 'America/New_York' }, error: null };
        },
      };
      return builder;
    },
  }),
}));

import { applyDispatchAction } from '@/app/tenant/schedule/dispatchActions';
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

describe('paused routing server actions', () => {
  beforeEach(() => {
    harness.billing = {
      status: 'active',
      platform_plan: 'pro',
      stripe_subscription_status: 'paused',
    };
    harness.dispatchCalls = 0;
    harness.reportCalls = 0;
  });

  it('refuses dispatch, re-optimize, and the drive-time CSV with the upgrade sentence', async () => {
    await expect(applyDispatchAction({}, dispatchForm())).resolves.toEqual({
      error: featureUpgradeMessage('multiCleanerDispatch'),
    });
    await expect(applyDispatchAction({}, dispatchForm('reoptimize'))).resolves.toEqual({
      error: featureUpgradeMessage('routeReoptimization'),
    });
    const response = await exportDriveTime(
      new Request(
        'http://qa-pro.lvh.me:3000/schedule/drive-time/export?from=2026-06-01&to=2026-06-02',
      ),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: featureUpgradeMessage('driveTimeReports') });
    expect(harness.dispatchCalls).toBe(0);
    expect(harness.reportCalls).toBe(0);
  });

  it('keeps Pro tools for a past_due subscription', async () => {
    harness.billing = {
      status: 'past_due',
      platform_plan: 'pro',
      stripe_subscription_status: 'past_due',
    };
    await expect(applyDispatchAction({}, dispatchForm())).resolves.toEqual({
      error: 'Could not build the dispatch.',
    });
    await expect(applyDispatchAction({}, dispatchForm('reoptimize'))).resolves.toEqual({
      error: 'Could not build the dispatch.',
    });
    const response = await exportDriveTime(
      new Request(
        'http://qa-pro.lvh.me:3000/schedule/drive-time/export?from=2026-06-01&to=2026-06-02',
      ),
    );
    expect(response.status).toBe(200);
    expect(harness.dispatchCalls).toBe(2);
    expect(harness.reportCalls).toBe(1);
  });
});
