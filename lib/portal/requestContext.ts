import { cache } from 'react';
import {
  requireTenantPortalAccess,
  type TenantMembership,
  type TenantPortalAccessOptions,
} from '@/lib/auth/tenantAccess';
import { resolveTenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';
import { resolveTenantEntitlementPlan, type EntitlementPlanKey } from '@/lib/billing/entitlements';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';

/**
 * Cached per request — layout + pages sharing the same slug/path do not repeat access checks.
 */
export const getTenantPortalMembership = cache(
  async (
    tenantSlug: string,
    browserPath: string,
    accessOptions?: TenantPortalAccessOptions,
  ): Promise<TenantMembership> => {
    return requireTenantPortalAccess(tenantSlug, browserPath, {
      browserPathname: browserPath,
      ...accessOptions,
    });
  },
);

export interface TenantBillingSnapshot {
  connectStatus: string | null;
  tenantIsActive: boolean;
  billingStatus: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
  stripeSubscriptionId: string | null;
  subscriptionAccess: ReturnType<typeof resolveTenantSubscriptionAccess>;
}

/** Tenant + billing rows used by the tenant portal shell (deduped per request). */
export const getTenantBillingSnapshot = cache(
  async (tenantId: string): Promise<TenantBillingSnapshot> => {
    const supabase = createTenantPortalDbClient();
    const [{ data: tenantRow }, { data: billingRow }] = await Promise.all([
      supabase
        .from('tenants')
        .select('stripe_connect_status, is_active')
        .eq('id', tenantId)
        .maybeSingle(),
      supabase
        .from('tenant_billing_accounts')
        .select('status, trial_ends_at, stripe_subscription_id, activated_at')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ]);

    const subscriptionAccess = resolveTenantSubscriptionAccess({
      billingStatus: billingRow?.status,
      trialEndsAt: billingRow?.trial_ends_at,
      tenantIsActive: tenantRow?.is_active !== false,
      stripeSubscriptionId: billingRow?.stripe_subscription_id,
    });

    return {
      connectStatus: tenantRow?.stripe_connect_status ?? null,
      tenantIsActive: tenantRow?.is_active !== false,
      billingStatus: billingRow?.status ?? null,
      trialEndsAt: billingRow?.trial_ends_at ?? null,
      activatedAt: billingRow?.activated_at ?? null,
      stripeSubscriptionId: billingRow?.stripe_subscription_id ?? null,
      subscriptionAccess,
    };
  },
);

export const getTenantEntitlementPlan = cache(
  async (tenantId: string): Promise<EntitlementPlanKey> => {
    const admin = createAdminClient();
    return resolveTenantEntitlementPlan(admin, tenantId);
  },
);
