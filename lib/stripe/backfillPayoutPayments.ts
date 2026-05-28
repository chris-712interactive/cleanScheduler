import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/database.types';
import { resolveConnectTenantId } from '@/lib/stripe/connectChargeMirrorHandlers';

type Admin = SupabaseClient<Database>;

function chargeIdFromBalanceTransaction(bt: Stripe.BalanceTransaction): string | null {
  if (bt.type !== 'charge') return null;
  const source = bt.source;
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'id' in source && typeof source.id === 'string') {
    return source.id;
  }
  return null;
}

/**
 * After payout.paid, associate card payments in this batch with the payout id
 * so Payment reconciliation can group by deposit.
 */
export async function backfillInvoicePaymentsForPayout(
  admin: Admin,
  stripe: Stripe,
  payout: Stripe.Payout,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;

  const chargeIds: string[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.balanceTransactions.list(
      {
        payout: payout.id,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { stripeAccount: connectAccountId },
    );

    for (const bt of page.data) {
      const chargeId = chargeIdFromBalanceTransaction(bt);
      if (chargeId) chargeIds.push(chargeId);
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  if (chargeIds.length === 0) return;

  const unique = [...new Set(chargeIds)];
  const { error } = await admin
    .from('tenant_invoice_payments')
    .update({ stripe_payout_id: payout.id })
    .eq('tenant_id', tenantId)
    .in('stripe_charge_id', unique)
    .is('stripe_payout_id', null);

  if (error) {
    throw new Error(error.message);
  }
}
