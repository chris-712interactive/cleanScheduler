import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/database.types';
import { backfillInvoicePaymentsForPayout } from '@/lib/stripe/backfillPayoutPayments';

type Admin = SupabaseClient<Database>;

export async function backfillStripePayoutLinksForTenant(
  admin: Admin,
  stripe: Stripe,
  tenantId: string,
): Promise<{ payoutsProcessed: number; errors: number }> {
  const { data: connect } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!connect?.stripe_account_id) {
    return { payoutsProcessed: 0, errors: 0 };
  }

  const { data: payouts } = await admin
    .from('tenant_stripe_payouts')
    .select('stripe_payout_id')
    .eq('tenant_id', tenantId);

  let errors = 0;
  let payoutsProcessed = 0;

  for (const row of payouts ?? []) {
    try {
      await backfillInvoicePaymentsForPayout(
        admin,
        stripe,
        { id: row.stripe_payout_id } as Stripe.Payout,
        connect.stripe_account_id,
      );
      payoutsProcessed += 1;
    } catch {
      errors += 1;
    }
  }

  return { payoutsProcessed, errors };
}

export async function backfillStripePayoutLinksForAllTenants(
  admin: Admin,
  stripe: Stripe,
): Promise<{ tenants: number; payoutsProcessed: number; errors: number }> {
  const { data: accounts } = await admin.from('tenant_stripe_connect_accounts').select('tenant_id');

  let payoutsProcessed = 0;
  let errors = 0;

  for (const acc of accounts ?? []) {
    const result = await backfillStripePayoutLinksForTenant(admin, stripe, acc.tenant_id);
    payoutsProcessed += result.payoutsProcessed;
    errors += result.errors;
  }

  return {
    tenants: accounts?.length ?? 0,
    payoutsProcessed,
    errors,
  };
}
