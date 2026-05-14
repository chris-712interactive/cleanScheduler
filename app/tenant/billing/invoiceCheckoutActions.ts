'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import {
  parseConnectApplicationFeeBps,
  paymentIntentApplicationFeeAmountCents,
} from '@/lib/billing/connectApplicationFee';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export async function createInvoicePayCheckoutSessionAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${invoiceId}`);
  const admin = createAdminClient();

  const gate = await requireConnectForOnlinePayments(admin, membership.tenantId);
  if (!gate.ok) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(gate.message)}`);
  }

  const [{ data: inv, error: invErr }, { data: conn, error: connErr }] = await Promise.all([
    admin
      .from('tenant_invoices')
      .select('id, title, currency, status, amount_cents, amount_paid_cents')
      .eq('id', invoiceId)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    admin
      .from('tenant_stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  if (invErr || !inv || inv.status === 'void') {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent('Invoice not found.')}`);
  }
  if (connErr || !conn?.stripe_account_id) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Stripe Connect is not linked.')}`,
    );
  }

  const remaining = inv.amount_cents - inv.amount_paid_cents;
  if (remaining <= 0) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Invoice is already paid.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Stripe is not configured.')}`,
    );
  }

  const origin = getPublicOrigin(membership.tenantSlug);
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
      success_url: `${origin}/billing/invoices/${invoiceId}?checkout=success`,
      cancel_url: `${origin}/billing/invoices/${invoiceId}?checkout=canceled`,
      metadata: {
        tenant_id: membership.tenantId,
        invoice_id: invoiceId,
        kind: 'tenant_invoice_pay',
      },
      payment_intent_data: {
        metadata: {
          tenant_id: membership.tenantId,
          invoice_id: invoiceId,
          kind: 'tenant_invoice_pay',
        },
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
      },
    },
    { stripeAccount: conn.stripe_account_id },
  );

  if (!session.url) {
    redirect(
      `/billing/invoices/${invoiceId}?error=${encodeURIComponent('Could not start checkout.')}`,
    );
  }

  redirect(session.url);
}
