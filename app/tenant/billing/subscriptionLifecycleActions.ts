'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createConnectCustomerBillingPortalSession } from '@/lib/billing/connectCustomerBillingPortal';

export async function cancelCustomerSubscriptionAtPeriodEndAction(
  formData: FormData,
): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const subscriptionRowId = String(formData.get('subscription_row_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const gate = await requireConnectForOnlinePayments(admin, membership.tenantId);
  if (!gate.ok) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent(gate.message)}`);
  }

  const { data: sub, error } = await admin
    .from('customer_subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('id', subscriptionRowId)
    .eq('tenant_id', membership.tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error || !sub?.stripe_subscription_id) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Subscription not found.')}`);
  }
  if (sub.status === 'canceled') {
    redirect(
      `/customers/${customerId}?error=${encodeURIComponent('Subscription already canceled.')}`,
    );
  }

  const { data: conn } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!conn?.stripe_account_id) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Connect account missing.')}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Stripe not configured.')}`);
  }

  try {
    await stripe.subscriptions.update(
      sub.stripe_subscription_id,
      { cancel_at_period_end: true },
      { stripeAccount: conn.stripe_account_id },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not cancel subscription';
    redirect(`/customers/${customerId}?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/customers/${customerId}?subscription_cancel=scheduled`);
}

export async function openTenantCustomerBillingPortalAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const gate = await requireConnectForOnlinePayments(admin, membership.tenantId);
  if (!gate.ok) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent(gate.message)}`);
  }

  const [{ data: link }, { data: conn }] = await Promise.all([
    admin
      .from('tenant_customer_stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', membership.tenantId)
      .eq('customer_id', customerId)
      .maybeSingle(),
    admin
      .from('tenant_stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  if (!link?.stripe_customer_id) {
    redirect(
      `/customers/${customerId}?error=${encodeURIComponent('Customer has no Stripe customer yet — run subscription or invoice checkout first.')}`,
    );
  }
  if (!conn?.stripe_account_id) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Connect account missing.')}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Stripe not configured.')}`);
  }

  const returnUrl = `${getPublicOrigin(membership.tenantSlug)}/customers/${customerId}`;
  const url = await createConnectCustomerBillingPortalSession({
    stripe,
    stripeAccountId: conn.stripe_account_id,
    stripeCustomerId: link.stripe_customer_id,
    returnUrl,
  });
  if (!url) {
    redirect(
      `/customers/${customerId}?error=${encodeURIComponent('Could not open billing portal.')}`,
    );
  }
  redirect(url);
}
