import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database, Json } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function handleConnectAccountUpdated(admin: Admin, account: Stripe.Account): Promise<void> {
  let tenantId = account.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    const { data } = await admin
      .from('tenant_stripe_connect_accounts')
      .select('tenant_id')
      .eq('stripe_account_id', account.id)
      .maybeSingle();
    tenantId = data?.tenant_id;
  }
  if (!tenantId) return;

  await admin
    .from('tenant_stripe_connect_accounts')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
      requirements_currently_due: (account.requirements?.currently_due as Json | null) ?? null,
      last_event_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
}

export async function handleTenantInvoiceCheckoutCompleted(
  admin: Admin,
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.metadata?.kind !== 'tenant_invoice_pay') return;
  const tenantId = session.metadata.tenant_id as string | undefined;
  const invoiceId = session.metadata.invoice_id as string | undefined;
  if (!tenantId || !invoiceId) return;

  const amountTotal = session.amount_total ?? 0;
  if (amountTotal <= 0) return;

  const pi =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { data: inv, error: invErr } = await admin
    .from('tenant_invoices')
    .select('id, tenant_id, status, amount_cents, amount_paid_cents')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invErr || !inv || inv.status === 'void') return;

  const remaining = inv.amount_cents - inv.amount_paid_cents;
  if (remaining <= 0) return;

  const { error: insErr } = await admin.from('tenant_invoice_payments').insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    amount_cents: Math.min(amountTotal, remaining),
    method: 'card',
    notes: 'Stripe Checkout (customer)',
    recorded_via: 'stripe_checkout',
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: pi,
    gross_amount_cents: amountTotal,
  });

  if (insErr?.code === '23505') {
    return;
  }
  if (insErr) {
    throw new Error(insErr.message);
  }
}

function mapTenantCustomerSubscriptionStatus(
  status: Stripe.Subscription.Status,
): Database['public']['Enums']['tenant_customer_subscription_status'] {
  switch (status) {
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'incomplete_expired';
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'paused':
      return 'paused';
    default:
      return 'incomplete';
  }
}

async function upsertTenantCustomerStripeCustomer(
  admin: Admin,
  params: { tenantId: string; customerId: string; stripeCustomerId: string },
): Promise<void> {
  const { error } = await admin.from('tenant_customer_stripe_customers').upsert(
    {
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      stripe_customer_id: params.stripeCustomerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,customer_id' },
  );
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Upserts a `customer_subscriptions` row from a Stripe Subscription on a
 * connected account (metadata.kind = tenant_customer_subscription).
 */
export async function upsertCustomerSubscriptionFromStripe(
  admin: Admin,
  subscription: Stripe.Subscription,
  connectAccountId: string,
): Promise<void> {
  if (subscription.metadata?.kind !== 'tenant_customer_subscription') return;

  const { data: acc, error: accErr } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('tenant_id')
    .eq('stripe_account_id', connectAccountId)
    .maybeSingle();

  if (accErr || !acc?.tenant_id) return;

  const tenantFromAccount = acc.tenant_id;
  const metaTenant = subscription.metadata?.tenant_id as string | undefined;
  if (metaTenant && metaTenant !== tenantFromAccount) return;

  const tenantId = tenantFromAccount;
  const customerId = subscription.metadata.customer_id as string | undefined;
  const servicePlanId = subscription.metadata.service_plan_id as string | undefined;
  if (!customerId || !servicePlanId) return;

  const stripeCust =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
  if (stripeCust) {
    await upsertTenantCustomerStripeCustomer(admin, {
      tenantId,
      customerId,
      stripeCustomerId: stripeCust,
    });
  }

  const status = mapTenantCustomerSubscriptionStatus(subscription.status);
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const row: Database['public']['Tables']['customer_subscriptions']['Update'] = {
    tenant_id: tenantId,
    customer_id: customerId,
    service_plan_id: servicePlanId,
    status,
    stripe_subscription_id: subscription.id,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from('customer_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from('customer_subscriptions').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const insertRow: Database['public']['Tables']['customer_subscriptions']['Insert'] = {
    tenant_id: tenantId,
    customer_id: customerId,
    service_plan_id: servicePlanId,
    status,
    stripe_subscription_id: subscription.id,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  };

  const { error: insErr } = await admin.from('customer_subscriptions').insert(insertRow);

  if (insErr?.code === '23505') {
    return;
  }
  if (insErr) {
    throw new Error(insErr.message);
  }
}

export async function handleTenantCustomerSubscriptionCheckoutCompleted(
  admin: Admin,
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  connectAccountId: string,
): Promise<void> {
  if (session.mode !== 'subscription') return;
  if (session.metadata?.kind !== 'tenant_customer_subscription') return;

  const subId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subId) return;

  const subscription = await stripe.subscriptions.retrieve(subId, { stripeAccount: connectAccountId });
  await upsertCustomerSubscriptionFromStripe(admin, subscription, connectAccountId);

  const tenantId = session.metadata.tenant_id as string | undefined;
  const customerId = session.metadata.customer_id as string | undefined;
  const stripeCust =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  if (tenantId && customerId && stripeCust) {
    await upsertTenantCustomerStripeCustomer(admin, { tenantId, customerId, stripeCustomerId: stripeCust });
  }
}
