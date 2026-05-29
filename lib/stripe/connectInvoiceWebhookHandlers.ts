import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/database.types';
import { afterInvoicePaymentRecorded } from '@/lib/integrations/emitInvoiceWebhook';
import { sendInvoiceReceiptEmail } from '@/lib/email/invoiceReceiptEmail';
import { resolveConnectTenantId } from '@/lib/stripe/connectChargeMirrorHandlers';
import {
  stripePaymentIntentIdFromInvoice,
  stripePaymentIntentLastErrorFromInvoice,
  stripeSubscriptionFromInvoice,
} from '@/lib/stripe/stripeBasilCompat';
import {
  invoiceTitleFromStripe,
  mapStripeInvoiceStatus,
  stripeCustomerIdFromInvoice,
  stripeInvoiceAmountCents,
  stripeInvoicePaidCents,
  stripeSubscriptionIdFromInvoice,
} from '@/lib/stripe/stripeInvoiceMirror';

type Admin = SupabaseClient<Database>;

async function resolveCustomerId(
  admin: Admin,
  tenantId: string,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const stripeCust = stripeCustomerIdFromInvoice(invoice);
  if (stripeCust) {
    const { data } = await admin
      .from('tenant_customer_stripe_customers')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('stripe_customer_id', stripeCust)
      .maybeSingle();
    if (data?.customer_id) return data.customer_id;
  }

  const subId = stripeSubscriptionIdFromInvoice(invoice);
  if (subId) {
    const subRaw = stripeSubscriptionFromInvoice(invoice);
    const subObj = typeof subRaw === 'object' && subRaw ? subRaw : null;
    const metaCustomer = subObj?.metadata?.customer_id as string | undefined;
    if (metaCustomer) return metaCustomer;

    const { data: cs } = await admin
      .from('customer_subscriptions')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('stripe_subscription_id', subId)
      .maybeSingle();
    if (cs?.customer_id) return cs.customer_id;
  }

  const metaCustomer = invoice.metadata?.customer_id as string | undefined;
  return metaCustomer ?? null;
}

function buildMirrorRow(
  tenantId: string,
  customerId: string,
  invoice: Stripe.Invoice,
): Database['public']['Tables']['tenant_invoices']['Insert'] {
  const dueDate =
    invoice.due_date != null ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10) : null;

  return {
    tenant_id: tenantId,
    customer_id: customerId,
    title: invoiceTitleFromStripe(invoice),
    status: mapStripeInvoiceStatus(invoice.status),
    currency: (invoice.currency ?? 'usd').toLowerCase(),
    amount_cents: stripeInvoiceAmountCents(invoice),
    amount_paid_cents: stripeInvoicePaidCents(invoice),
    due_date: dueDate,
    source: 'stripe_billing',
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: stripeSubscriptionIdFromInvoice(invoice),
    stripe_customer_id: stripeCustomerIdFromInvoice(invoice),
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf_url: invoice.invoice_pdf ?? null,
    billing_period_start:
      invoice.period_start != null ? new Date(invoice.period_start * 1000).toISOString() : null,
    billing_period_end:
      invoice.period_end != null ? new Date(invoice.period_end * 1000).toISOString() : null,
    last_payment_error: null,
  };
}

async function upsertStripeBillingInvoice(
  admin: Admin,
  tenantId: string,
  invoice: Stripe.Invoice,
): Promise<{ invoiceId: string | null }> {
  const customerId = await resolveCustomerId(admin, tenantId, invoice);
  if (!customerId) return { invoiceId: null };

  const row = buildMirrorRow(tenantId, customerId, invoice);

  const { data: existing } = await admin
    .from('tenant_invoices')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('tenant_invoices')
      .update({
        title: row.title,
        status: row.status,
        amount_cents: row.amount_cents,
        amount_paid_cents: row.amount_paid_cents,
        due_date: row.due_date,
        hosted_invoice_url: row.hosted_invoice_url,
        invoice_pdf_url: row.invoice_pdf_url,
        billing_period_start: row.billing_period_start,
        billing_period_end: row.billing_period_end,
        stripe_subscription_id: row.stripe_subscription_id,
        stripe_customer_id: row.stripe_customer_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
    return { invoiceId: existing.id };
  }

  const { data: inserted, error: insErr } = await admin
    .from('tenant_invoices')
    .insert(row)
    .select('id')
    .single();

  if (insErr?.code === '23505') {
    const { data: again } = await admin
      .from('tenant_invoices')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle();
    return { invoiceId: again?.id ?? null };
  }
  if (insErr) throw new Error(insErr.message);

  return { invoiceId: inserted.id };
}

async function backfillPaymentFees(
  admin: Admin,
  stripe: Stripe,
  connectAccountId: string,
  paymentRowId: string,
  paymentIntentId: string,
): Promise<void> {
  try {
    const piFull = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount: connectAccountId },
    );
    const charge = piFull.latest_charge as Stripe.Charge | null | undefined;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | string | null | undefined;
    const btx = typeof bt === 'object' && bt && 'fee' in bt ? bt : null;
    const appFee =
      typeof piFull.application_fee_amount === 'number' ? piFull.application_fee_amount : null;

    await admin
      .from('tenant_invoice_payments')
      .update({
        stripe_charge_id: charge?.id ?? null,
        stripe_balance_transaction_id: btx?.id ?? null,
        stripe_fee_cents: btx?.fee ?? null,
        application_fee_cents: appFee,
        net_amount_cents: btx?.net ?? null,
        gross_amount_cents: piFull.amount_received ?? null,
      })
      .eq('id', paymentRowId);
  } catch {
    // Fee mirror is best-effort.
  }
}

async function recordInvoicePaidPayment(
  admin: Admin,
  params: {
    tenantId: string;
    invoiceId: string;
    invoice: Stripe.Invoice;
    stripe?: Stripe;
    connectAccountId?: string;
  },
): Promise<void> {
  const paymentIntentId = stripePaymentIntentIdFromInvoice(params.invoice);

  if (paymentIntentId) {
    const { data: existingPay } = await admin
      .from('tenant_invoice_payments')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingPay?.id) {
      await afterInvoicePaymentRecorded(admin, {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
      });
      return;
    }
  }

  const payAmount = params.invoice.amount_paid ?? params.invoice.total ?? 0;
  if (payAmount <= 0) {
    await afterInvoicePaymentRecorded(admin, {
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
    });
    return;
  }

  const { data: inserted, error: insErr } = await admin
    .from('tenant_invoice_payments')
    .insert({
      tenant_id: params.tenantId,
      invoice_id: params.invoiceId,
      amount_cents: payAmount,
      method: 'card',
      notes: 'Stripe Billing invoice',
      recorded_via: 'stripe_checkout',
      stripe_payment_intent_id: paymentIntentId,
      gross_amount_cents: payAmount,
    })
    .select('id')
    .maybeSingle();

  if (insErr?.code === '23505') {
    await afterInvoicePaymentRecorded(admin, {
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
    });
    return;
  }
  if (insErr) throw new Error(insErr.message);

  if (inserted?.id && paymentIntentId && params.stripe && params.connectAccountId) {
    await backfillPaymentFees(
      admin,
      params.stripe,
      params.connectAccountId,
      inserted.id,
      paymentIntentId,
    );
  }

  await afterInvoicePaymentRecorded(admin, {
    tenantId: params.tenantId,
    invoiceId: params.invoiceId,
  });

  await sendInvoiceReceiptEmail(admin, {
    tenantId: params.tenantId,
    invoiceId: params.invoiceId,
    paymentAmountCents: payAmount,
  });
}

export async function handleConnectInvoiceUpsert(
  admin: Admin,
  invoice: Stripe.Invoice,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;

  await upsertStripeBillingInvoice(admin, tenantId, invoice);
}

export async function handleConnectInvoicePaid(
  admin: Admin,
  invoice: Stripe.Invoice,
  connectAccountId: string,
  options?: { stripe?: Stripe },
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;

  const { invoiceId } = await upsertStripeBillingInvoice(admin, tenantId, invoice);
  if (!invoiceId) return;

  await admin
    .from('tenant_invoices')
    .update({
      status: 'paid',
      amount_paid_cents: invoice.amount_paid ?? invoice.total ?? 0,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf_url: invoice.invoice_pdf ?? null,
      last_payment_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId);

  await recordInvoicePaidPayment(admin, {
    tenantId,
    invoiceId,
    invoice,
    stripe: options?.stripe,
    connectAccountId,
  });
}

export async function handleConnectInvoicePaymentFailed(
  admin: Admin,
  invoice: Stripe.Invoice,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;

  const { invoiceId } = await upsertStripeBillingInvoice(admin, tenantId, invoice);
  if (!invoiceId) return;

  const errMsg =
    invoice.last_finalization_error?.message?.trim() ||
    stripePaymentIntentLastErrorFromInvoice(invoice)?.message?.trim() ||
    'Payment failed';

  await admin
    .from('tenant_invoices')
    .update({
      status: 'open',
      last_payment_error: errMsg,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf_url: invoice.invoice_pdf ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId);
}

export async function handleConnectInvoiceVoided(
  admin: Admin,
  invoice: Stripe.Invoice,
  connectAccountId: string,
): Promise<void> {
  const tenantId = await resolveConnectTenantId(admin, connectAccountId);
  if (!tenantId) return;

  const { invoiceId } = await upsertStripeBillingInvoice(admin, tenantId, invoice);
  if (!invoiceId) return;

  await admin
    .from('tenant_invoices')
    .update({
      status: 'void',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId);
}
