'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  parseConnectApplicationFeeBps,
  paymentIntentApplicationFeeAmountCents,
} from '@/lib/billing/connectApplicationFee';

export async function createCustomerInvoicePayCheckoutSessionAction(
  formData: FormData,
): Promise<void> {
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const auth = await requirePortalAccess('customer', `/invoices/${invoiceId}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.length) {
    redirect('/access-denied?reason=no_customer_profile');
  }

  const admin = createAdminClient();
  const { data: inv, error: invErr } = await admin
    .from('tenant_invoices')
    .select('id, tenant_id, title, currency, status, amount_cents, amount_paid_cents, customer_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invErr || !inv || inv.status === 'void') {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent('Invoice not found.')}`);
  }
  if (!ctx.customerIds.includes(inv.customer_id)) {
    redirect(
      `/invoices/${invoiceId}?error=${encodeURIComponent('You do not have access to this invoice.')}`,
    );
  }

  const gate = await requireConnectForOnlinePayments(admin, inv.tenant_id);
  if (!gate.ok) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(gate.message)}`);
  }

  const { data: conn, error: connErr } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', inv.tenant_id)
    .maybeSingle();

  if (connErr || !conn?.stripe_account_id) {
    redirect(
      `/invoices/${invoiceId}?error=${encodeURIComponent('This provider has not finished payment setup.')}`,
    );
  }

  const remaining = inv.amount_cents - inv.amount_paid_cents;
  if (remaining <= 0) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent('Invoice is already paid.')}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent('Stripe is not configured.')}`);
  }

  const origin = getPublicOrigin('my');
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
      success_url: `${origin}/invoices/${invoiceId}?checkout=success`,
      cancel_url: `${origin}/invoices/${invoiceId}?checkout=canceled`,
      metadata: {
        tenant_id: inv.tenant_id,
        invoice_id: invoiceId,
        kind: 'tenant_invoice_pay',
      },
      payment_intent_data: {
        metadata: {
          tenant_id: inv.tenant_id,
          invoice_id: invoiceId,
          kind: 'tenant_invoice_pay',
        },
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
      },
    },
    { stripeAccount: conn.stripe_account_id },
  );

  if (!session.url) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent('Could not start checkout.')}`);
  }

  redirect(session.url);
}
