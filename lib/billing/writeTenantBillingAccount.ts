import type { SupabaseClient } from '@supabase/supabase-js';
import { STRIPE_SUBSCRIPTION_STATUS_COLUMN } from '@/lib/billing/loadTextingBilling';
import { isMissingColumnError } from '@/lib/supabase/optionalColumn';
import type { Database } from '@/lib/supabase/database.types';

type BillingUpdate = Database['public']['Tables']['tenant_billing_accounts']['Update'];

/** Writes a billing row. Drops the raw Stripe status when that column is not applied yet. */
export async function writeTenantBillingAccount(
  admin: SupabaseClient<Database>,
  tenantId: string,
  payload: BillingUpdate,
): Promise<void> {
  const first = await admin
    .from('tenant_billing_accounts')
    .update(payload)
    .eq('tenant_id', tenantId);
  if (!first.error) return;

  if (
    !isMissingColumnError(first.error, STRIPE_SUBSCRIPTION_STATUS_COLUMN) ||
    !(STRIPE_SUBSCRIPTION_STATUS_COLUMN in payload)
  ) {
    throw new Error(`tenant_billing_accounts update failed: ${first.error.message}`);
  }

  const rest = { ...payload };
  delete rest.stripe_subscription_status;
  const second = await admin.from('tenant_billing_accounts').update(rest).eq('tenant_id', tenantId);
  if (second.error) {
    throw new Error(`tenant_billing_accounts update failed: ${second.error.message}`);
  }
}
