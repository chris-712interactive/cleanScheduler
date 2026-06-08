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

export interface PlatformTenantSubscriptionRow {
  tenantSlug: string;
  tenantName: string;
  isActive: boolean;
  status: string;
  platformPlan: PlatformPlanTier | null;
  platformPlanLabel: string | null;
  billingInterval: 'month' | 'year' | null;
  monthlyRecurringCents: number;
  estimatedYtdCents: number;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
}

export interface PlatformAccountingSummary {
  estimatedMrrCents: number;
  activePaidSubscriptions: number;
  estimatedRevenueYtdCents: number;
  tenantSubscriptions: PlatformTenantSubscriptionRow[];
}

const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

function yearStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

/** Estimated platform revenue YTD from active subscriptions and activation dates. */
function estimateYtdCentsForAccount(row: {
  status: string;
  activated_at: string | null;
  created_at: string;
  monthlyRecurringCents: number;
}): number {
  if (row.monthlyRecurringCents <= 0 || row.status !== 'active') return 0;

  const yearStart = yearStartUtc();
  const activated = row.activated_at ? new Date(row.activated_at) : null;
  const effectiveStart = activated && activated > yearStart ? activated : (activated ?? yearStart);
  const now = Date.now();
  if (effectiveStart.getTime() > now) return 0;

  const months = (now - effectiveStart.getTime()) / MS_PER_MONTH;
  return Math.round(row.monthlyRecurringCents * months);
}

function normalizeBillingAccount<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/**
 * Founder accounting aggregates: MRR, estimated revenue YTD, and per-tenant subscriptions.
 */
export async function getPlatformAccountingSummary(): Promise<PlatformAccountingSummary> {
  const db = createAdminClient();

  const { data, error } = await db
    .from('tenants')
    .select(
      `
      slug,
      name,
      is_active,
      tenant_billing_accounts (
        status,
        platform_plan,
        billing_interval,
        stripe_subscription_id,
        trial_ends_at,
        activated_at,
        created_at
      )
    `,
    )
    .order('slug', { ascending: true });

  if (error || !data) {
    return {
      estimatedMrrCents: 0,
      activePaidSubscriptions: 0,
      estimatedRevenueYtdCents: 0,
      tenantSubscriptions: [],
    };
  }

  let estimatedMrrCents = 0;
  let activePaidSubscriptions = 0;
  let estimatedRevenueYtdCents = 0;
  const tenantSubscriptions: PlatformTenantSubscriptionRow[] = [];

  for (const tenant of data) {
    const billing = normalizeBillingAccount(tenant.tenant_billing_accounts);
    const tier = parsePlatformPlanTier(billing?.platform_plan) as PlatformPlanTier | null;
    const monthlyRecurringCents = billing
      ? monthlyRecurringCentsForAccount({
          status: billing.status,
          platform_plan: tier,
          billing_interval: billing.billing_interval,
        })
      : 0;

    if (monthlyRecurringCents > 0) {
      estimatedMrrCents += monthlyRecurringCents;
      activePaidSubscriptions += 1;
    }

    const estimatedYtdCents = billing
      ? estimateYtdCentsForAccount({
          status: billing.status,
          activated_at: billing.activated_at,
          created_at: billing.created_at,
          monthlyRecurringCents,
        })
      : 0;
    estimatedRevenueYtdCents += estimatedYtdCents;

    tenantSubscriptions.push({
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      isActive: tenant.is_active,
      status: billing?.status ?? 'none',
      platformPlan: tier,
      platformPlanLabel: tier ? PLATFORM_TIER_ENTITLEMENTS[tier].displayName : null,
      billingInterval: billing?.billing_interval ?? null,
      monthlyRecurringCents,
      estimatedYtdCents,
      stripeSubscriptionId: billing?.stripe_subscription_id ?? null,
      trialEndsAt: billing?.trial_ends_at ?? null,
      activatedAt: billing?.activated_at ?? null,
    });
  }

  tenantSubscriptions.sort((a, b) => b.monthlyRecurringCents - a.monthlyRecurringCents);

  return {
    estimatedMrrCents,
    activePaidSubscriptions,
    estimatedRevenueYtdCents,
    tenantSubscriptions,
  };
}
