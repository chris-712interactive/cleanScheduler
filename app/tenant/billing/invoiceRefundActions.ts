'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';

export async function refundStripeInvoicePaymentAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${invoiceId}`);
  const admin = createAdminClient();

  const gate = await requireConnectForOnlinePayments(admin, membership.tenantId);
  if (!gate.ok) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(gate.message)}`);
  }

  const { data: pay, error: pErr } = await admin
    .from('tenant_invoice_payments')
    .select('id, tenant_id, invoice_id, amount_cents, stripe_charge_id, recorded_via')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (pErr || !pay?.stripe_charge_id || pay.recorded_via !== 'stripe_checkout') {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Only Stripe Checkout card payments can be refunded here.')}`,
    );
  }

  const { data: conn } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!conn?.stripe_account_id) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Connect account missing.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Stripe not configured.')}`,
    );
  }

  const dollars = String(formData.get('refund_amount_dollars') ?? '').trim();
  let refundCents: number | undefined;
  if (dollars) {
    const n = Number.parseFloat(dollars.replace(/[$,]/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      redirect(
        `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Invalid refund amount.')}`,
      );
    }
    refundCents = Math.round(n * 100);
  }

  try {
    await stripe.refunds.create(
      {
        charge: pay.stripe_charge_id,
        ...(refundCents ? { amount: Math.min(refundCents, pay.amount_cents) } : {}),
      },
      { stripeAccount: conn.stripe_account_id },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Refund failed';
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(msg)}`);
  }

  const applied = refundCents != null ? Math.min(refundCents, pay.amount_cents) : pay.amount_cents;
  const neg = -applied;

  const { error: insErr } = await admin.from('tenant_invoice_payments').insert({
    tenant_id: membership.tenantId,
    invoice_id: invoiceId,
    amount_cents: neg,
    method: 'card',
    notes: `Stripe refund (charge ${pay.stripe_charge_id})`,
    recorded_via: 'manual',
  });

  if (insErr) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(insErr.message)}`);
  }

  redirect(`/billing/invoices/${invoiceId}?refund=ok`);
}
