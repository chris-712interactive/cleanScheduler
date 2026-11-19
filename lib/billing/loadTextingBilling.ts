import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantBillingStatus } from '@/lib/billing/tenantSubscriptionAccess';
import { isMissingColumnError } from '@/lib/supabase/optionalColumn';
import type { Database } from '@/lib/supabase/database.types';

export const STRIPE_SUBSCRIPTION_STATUS_COLUMN = 'stripe_subscription_status';

export type TextingBilling = {
  status: TenantBillingStatus | null;
  rawStripeStatus: string | null;
};

/**
 * Mapped billing status plus the raw Stripe subscription status.
 * A missing column is treated as a null raw status so texting keeps working
 * before migration 0132 is applied.
 */
export async function loadTextingBilling(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TextingBilling> {
  const first = await admin
    .from('tenant_billing_accounts')
    .select('status, stripe_subscription_status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!first.error) {
    return {
      status: first.data?.status ?? null,
      rawStripeStatus: first.data?.stripe_subscription_status ?? null,
    };
  }

  if (!isMissingColumnError(first.error, STRIPE_SUBSCRIPTION_STATUS_COLUMN)) {
    throw new Error(first.error.message);
  }

  const second = await admin
    .from('tenant_billing_accounts')
    .select('status')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (second.error) {
    throw new Error(second.error.message);
  }
  return {
    status: second.data?.status ?? null,
    rawStripeStatus: null,
  };
}
