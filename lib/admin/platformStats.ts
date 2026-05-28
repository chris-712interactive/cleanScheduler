import { createAdminClient } from '@/lib/supabase/server';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export interface PlatformDashboardStats {
  activeTenants: number;
  tenantsOnTrial: number;
  newTenantsLast7Days: number;
  customerRecords: number;
  estimatedMrrCents: number;
  activePaidSubscriptions: number;
  connectCompleteTenants: number;
  connectTrackedTenants: number;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function monthlyRecurringCentsForAccount(row: {
  status: string;
  platform_plan: PlatformPlanTier | null;
  billing_interval: 'month' | 'year' | null;
}): number {
  if (row.status !== 'active' && row.status !== 'trialing') return 0;
  const tier = row.platform_plan ?? 'starter';
  const entitlements = PLATFORM_TIER_ENTITLEMENTS[tier];
  const monthlyUsd =
    row.billing_interval === 'year'
      ? entitlements.annualEffectiveMonthlyUsd
      : entitlements.monthlyPriceUsd;
  return Math.round(monthlyUsd * 100);
}

/**
 * Founder dashboard aggregates via service role (trusted admin routes only).
 */
export async function getPlatformDashboardStats(): Promise<PlatformDashboardStats> {
  const db = createAdminClient();

  const [activeTenantsRes, trialRes, newTenantsRes, customersRes, billingRowsRes, connectRes] =
    await Promise.all([
      db.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db
        .from('tenant_billing_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'trialing'),
      db
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', daysAgoIso(7)),
      db.from('customers').select('*', { count: 'exact', head: true }),
      db
        .from('tenant_billing_accounts')
        .select('status, platform_plan, billing_interval')
        .in('status', ['active', 'trialing']),
      db.from('tenants').select('stripe_connect_status').eq('is_active', true),
    ]);

  const safe = (res: { count?: number | null; error?: unknown }) =>
    res.error ? 0 : (res.count ?? 0);

  let estimatedMrrCents = 0;
  let activePaidSubscriptions = 0;
  for (const row of billingRowsRes.data ?? []) {
    const tier = parsePlatformPlanTier(row.platform_plan) as PlatformPlanTier | null;
    const cents = monthlyRecurringCentsForAccount({
      status: row.status,
      platform_plan: tier,
      billing_interval: row.billing_interval,
    });
    if (cents > 0) {
      estimatedMrrCents += cents;
      activePaidSubscriptions += 1;
    }
  }

  const connectRows = connectRes.data ?? [];
  const connectCompleteTenants = connectRows.filter(
    (row) => row.stripe_connect_status === 'complete',
  ).length;

  return {
    activeTenants: safe(activeTenantsRes),
    tenantsOnTrial: safe(trialRes),
    newTenantsLast7Days: safe(newTenantsRes),
    customerRecords: safe(customersRes),
    estimatedMrrCents,
    activePaidSubscriptions,
    connectCompleteTenants,
    connectTrackedTenants: connectRows.length,
  };
}

export function formatPlatformMrrLabel(mrrCents: number): string {
  if (mrrCents <= 0) return '$0';
  return `$${(mrrCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
