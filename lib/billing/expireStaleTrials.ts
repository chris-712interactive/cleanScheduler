import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Expire workspace trials that only exist in Postgres (no Stripe subscription).
 * Stripe-managed trials are ended by `customer.subscription.*` webhooks instead.
 */
export async function expireStaleDbOnlyTrials(
  admin: SupabaseClient<Database>,
): Promise<{ expiredTenantIds: string[] }> {
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id')
    .eq('status', 'trialing')
    .lt('trial_ends_at', nowIso)
    .is('stripe_subscription_id', null);

  if (error) {
    throw new Error(error.message);
  }

  const tenantIds = (rows ?? []).map((r) => r.tenant_id).filter(Boolean);
  if (tenantIds.length === 0) {
    return { expiredTenantIds: [] };
  }

  const { error: billingError } = await admin
    .from('tenant_billing_accounts')
    .update({
      status: 'canceled',
      canceled_at: nowIso,
    })
    .in('tenant_id', tenantIds);

  if (billingError) {
    throw new Error(billingError.message);
  }

  const { error: tenantError } = await admin
    .from('tenants')
    .update({ is_active: false })
    .in('id', tenantIds);

  if (tenantError) {
    throw new Error(tenantError.message);
  }

  return { expiredTenantIds: tenantIds };
}
