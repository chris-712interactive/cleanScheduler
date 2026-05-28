import { createAdminClient } from '@/lib/supabase/server';
import {
  resolveTenantSubscriptionAccess,
  type TenantSubscriptionAccess,
} from '@/lib/billing/tenantSubscriptionAccess';

export interface TenantSubscriptionAccessSnapshot {
  tenantId: string;
  access: TenantSubscriptionAccess;
}

/** Loads billing + tenant flags for middleware and server gates (service role). */
export async function resolveTenantSubscriptionAccessForSlug(
  tenantSlug: string,
): Promise<TenantSubscriptionAccessSnapshot | null> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug) return null;

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (tenantError || !tenant) return null;

  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('status, trial_ends_at, stripe_subscription_id')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const access = resolveTenantSubscriptionAccess({
    billingStatus: billing?.status,
    trialEndsAt: billing?.trial_ends_at,
    tenantIsActive: tenant.is_active !== false,
    stripeSubscriptionId: billing?.stripe_subscription_id,
  });

  return { tenantId: tenant.id, access };
}
