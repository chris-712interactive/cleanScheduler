'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import {
  parseConnectApplicationFeeBps,
  paymentIntentApplicationFeeAmountCents,
} from '@/lib/billing/connectApplicationFee';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export async function startGuestInvoicePayCheckoutAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  if (!token) redirect('/pay/invalid');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenant_invoice_pay_tokens')
    .select('id, tenant_id, invoice_id, expires_at, used_at, token')
    .eq('token', token)
    .maybeSingle();

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  const gate = await requireConnectForOnlinePayments(admin, row.tenant_id);
  if (!gate.ok) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  const [{ data: inv }, { data: conn }] = await Promise.all([
    admin
      .from('tenant_invoices')
      .select('id, title, currency, status, amount_cents, amount_paid_cents')
      .eq('id', row.invoice_id)
      .eq('tenant_id', row.tenant_id)
      .maybeSingle(),
    admin
      .from('tenant_stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', row.tenant_id)
      .maybeSingle(),
  ]);

  if (!inv || inv.status === 'void' || !conn?.stripe_account_id) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  const remaining = inv.amount_cents - inv.amount_paid_cents;
  if (remaining <= 0) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  const origin = getPublicOrigin(null);
  const feeBps = parseConnectApplicationFeeBps();
  const applicationFeeAmount = paymentIntentApplicationFeeAmountCents(remaining, feeBps);

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: (inv.currency ?? 'usd').toLowerCase(),
            unit_amount: remaining,
            product_data: {
              name: inv.title?.trim() || 'Invoice',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/pay/${encodeURIComponent(token)}?checkout=success`,
      cancel_url: `${origin}/pay/${encodeURIComponent(token)}?checkout=canceled`,
      metadata: {
        tenant_id: row.tenant_id,
        invoice_id: inv.id,
        kind: 'tenant_invoice_pay',
        pay_token: token,
      },
      payment_intent_data: {
        metadata: {
          tenant_id: row.tenant_id,
          invoice_id: inv.id,
          kind: 'tenant_invoice_pay',
        },
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
      },
    },
    { stripeAccount: conn.stripe_account_id },
  );

  if (!session.url) {
    redirect(`/pay/${encodeURIComponent(token)}`);
  }

  redirect(session.url);
}
