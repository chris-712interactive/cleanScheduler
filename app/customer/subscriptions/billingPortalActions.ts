'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { createConnectCustomerBillingPortalSession } from '@/lib/billing/connectCustomerBillingPortal';

export async function openCustomerBillingPortalAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const auth = await requirePortalAccess('customer', '/subscriptions');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.includes(customerId)) {
    redirect('/access-denied?reason=forbidden');
  }
  const allowed = ctx.links.some((l) => l.tenantId === tenantId && l.customerId === customerId);
  if (!allowed) {
    redirect('/access-denied?reason=forbidden');
  }

  const admin = createAdminClient();
  const gate = await requireConnectForOnlinePayments(admin, tenantId);
  if (!gate.ok) {
    redirect(`/subscriptions?error=${encodeURIComponent(gate.message)}`);
  }

  const [{ data: link }, { data: conn }] = await Promise.all([
    admin
      .from('tenant_customer_stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle(),
    admin
      .from('tenant_stripe_connect_accounts')
      .select('stripe_account_id')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!link?.stripe_customer_id || !conn?.stripe_account_id) {
    redirect(
      `/subscriptions?error=${encodeURIComponent('Billing portal is not available for this provider yet.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/subscriptions?error=${encodeURIComponent('Stripe is not configured.')}`);
  }

  const returnUrl = `${getPublicOrigin('my')}/subscriptions`;
  const url = await createConnectCustomerBillingPortalSession({
    stripe,
    stripeAccountId: conn.stripe_account_id,
    stripeCustomerId: link.stripe_customer_id,
    returnUrl,
  });
  if (!url) {
    redirect(`/subscriptions?error=${encodeURIComponent('Could not open billing portal.')}`);
  }
  redirect(url);
}

export async function cancelCustomerOwnSubscriptionAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const subscriptionRowId = String(formData.get('subscription_row_id') ?? '').trim();
  const auth = await requirePortalAccess('customer', '/subscriptions');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.includes(customerId)) {
    redirect('/access-denied?reason=forbidden');
  }
  if (!ctx.links.some((l) => l.tenantId === tenantId && l.customerId === customerId)) {
    redirect('/access-denied?reason=forbidden');
  }

  const admin = createAdminClient();
  const gate = await requireConnectForOnlinePayments(admin, tenantId);
  if (!gate.ok) {
    redirect(`/subscriptions?error=${encodeURIComponent(gate.message)}`);
  }

  const { data: sub, error } = await admin
    .from('customer_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('id', subscriptionRowId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error || !sub?.stripe_subscription_id || sub.status === 'canceled') {
    redirect(
      `/subscriptions?error=${encodeURIComponent('Subscription not found or already canceled.')}`,
    );
  }

  const { data: conn } = await admin
    .from('tenant_stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!conn?.stripe_account_id) {
    redirect(`/subscriptions?error=${encodeURIComponent('Connect account missing.')}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/subscriptions?error=${encodeURIComponent('Stripe is not configured.')}`);
  }

  try {
    await stripe.subscriptions.update(
      sub.stripe_subscription_id,
      { cancel_at_period_end: true },
      { stripeAccount: conn.stripe_account_id },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not cancel subscription';
    redirect(`/subscriptions?error=${encodeURIComponent(msg)}`);
  }

  redirect('/subscriptions?subscription_cancel=scheduled');
}
