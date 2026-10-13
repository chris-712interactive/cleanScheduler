import { createAdminClient } from '@/lib/supabase/server';
import {
  resolveTenantSubscriptionAccess,
  type TenantSubscriptionAccess,
} from '@/lib/billing/tenantSubscriptionAccess';

export interface TenantSubscriptionAccessSnapshot {
  tenantId: string;
  access: TenantSubscriptionAccess;
  adminSuspended: boolean;
  connectStatus: string | null;
  tenantIsActive: boolean;
  billingStatus: TenantSubscriptionAccessInputStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
  canceledAt: string | null;
  stripeSubscriptionId: string | null;
}

type TenantSubscriptionAccessInputStatus = Parameters<
  typeof resolveTenantSubscriptionAccess
>[0]['billingStatus'];

/** Loads billing + tenant flags for middleware and server gates (service role). */
export async function resolveTenantSubscriptionAccessForSlug(
  tenantSlug: string,
): Promise<TenantSubscriptionAccessSnapshot | null> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug) return null;

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, is_active, admin_access_suspended_at, stripe_connect_status')
    .eq('slug', slug)
    .maybeSingle();

  if (tenantError || !tenant) return null;

  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('status, trial_ends_at, stripe_subscription_id, activated_at, canceled_at')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const access = resolveTenantSubscriptionAccess({
    billingStatus: billing?.status,
    trialEndsAt: billing?.trial_ends_at,
    tenantIsActive: tenant.is_active !== false,
    stripeSubscriptionId: billing?.stripe_subscription_id,
  });

  return {
    tenantId: tenant.id,
    access,
    adminSuspended: Boolean(tenant.admin_access_suspended_at),
    connectStatus: tenant.stripe_connect_status ?? null,
    tenantIsActive: tenant.is_active !== false,
    billingStatus: billing?.status ?? null,
    trialEndsAt: billing?.trial_ends_at ?? null,
    activatedAt: billing?.activated_at ?? null,
    canceledAt: billing?.canceled_at ?? null,
    stripeSubscriptionId: billing?.stripe_subscription_id ?? null,
  };
}
