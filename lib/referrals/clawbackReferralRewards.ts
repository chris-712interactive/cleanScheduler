import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getCustomerWalletBalanceCents } from '@/lib/promotions/customerWallet';

type Admin = SupabaseClient<Database>;

export async function clawbackReferralRewardEvents(
  admin: Admin,
  input: {
    tenantId: string;
    attributionId: string;
    reason: string;
  },
): Promise<{ reversedCents: number; eventsProcessed: number }> {
  const { data: events, error } = await admin
    .from('referral_reward_events')
    .select('id, customer_id, amount_applied_cents, wallet_transaction_id, clawed_back_at')
    .eq('tenant_id', input.tenantId)
    .eq('attribution_id', input.attributionId);

  if (error) throw new Error(error.message);

  let reversedCents = 0;
  let eventsProcessed = 0;

  for (const event of events ?? []) {
    if (event.clawed_back_at) continue;

    const amount = event.amount_applied_cents ?? 0;
    if (amount <= 0) {
      await admin
        .from('referral_reward_events')
        .update({ clawed_back_at: new Date().toISOString() })
        .eq('id', event.id);
      eventsProcessed += 1;
      continue;
    }

    const balance = await getCustomerWalletBalanceCents(admin, input.tenantId, event.customer_id);
    const reverseAmount = Math.min(amount, balance);

    if (reverseAmount > 0) {
      const next = balance - reverseAmount;
      const { error: txError } = await admin.from('tenant_customer_wallet_transactions').insert({
        tenant_id: input.tenantId,
        customer_id: event.customer_id,
        kind: 'credit_reverse',
        amount_cents: reverseAmount,
        balance_after_cents: next,
        note: `${input.reason} (reward event ${event.id})`,
      });

      if (txError) throw new Error(txError.message);

      await admin.from('tenant_customer_wallets').upsert(
        {
          tenant_id: input.tenantId,
          customer_id: event.customer_id,
          balance_cents: next,
        },
        { onConflict: 'tenant_id,customer_id' },
      );

      reversedCents += reverseAmount;
    }

    await admin
      .from('referral_reward_events')
      .update({ clawed_back_at: new Date().toISOString() })
      .eq('id', event.id);

    eventsProcessed += 1;
  }

  return { reversedCents, eventsProcessed };
}

export async function maybeClawbackReferralOnQualifyingInvoiceChange(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<void> {
  const { data: invoice, error: invoiceError } = await admin
    .from('tenant_invoices')
    .select('id, customer_id, status, amount_cents, amount_paid_cents')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice?.customer_id) return;

  const fullyPaid = invoice.status === 'paid' && invoice.amount_paid_cents >= invoice.amount_cents;
  if (fullyPaid) return;

  const { data: attribution } = await admin
    .from('referral_attributions')
    .select('id, status')
    .eq('tenant_id', params.tenantId)
    .eq('qualifying_invoice_id', params.invoiceId)
    .eq('status', 'qualified')
    .maybeSingle();

  if (!attribution) return;

  await clawbackReferralRewardEvents(admin, {
    tenantId: params.tenantId,
    attributionId: attribution.id,
    reason: 'Referral clawback — qualifying invoice no longer paid in full',
  });

  await admin
    .from('referral_attributions')
    .update({ status: 'voided' })
    .eq('id', attribution.id)
    .eq('status', 'qualified');
}
