'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';
import { getStripe } from '@/lib/stripe/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  parseConnectApplicationFeeBps,
  subscriptionApplicationFeePercent,
} from '@/lib/billing/connectApplicationFee';

const SUBSCRIPTION_CHECKOUT_KIND = 'tenant_customer_subscription' as const;

export async function createCustomerSubscriptionCheckoutSessionAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const servicePlanId = String(formData.get('service_plan_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const gate = await requireConnectForOnlinePayments(admin, membership.tenantId);
  if (!gate.ok) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent(gate.message)}`);
  }

  const [{ data: plan, error: planErr }, { data: cust, error: custErr }, { data: conn, error: connErr }, { data: link }] =
    await Promise.all([
      admin
        .from('service_plans')
        .select('id, name, amount_cents, currency, billing_interval')
        .eq('id', servicePlanId)
        .eq('tenant_id', membership.tenantId)
        .eq('is_active', true)
        .maybeSingle(),
      admin
        .from('customers')
        .select(
          `
        id,
        customer_identities ( email )
      `,
        )
        .eq('id', customerId)
        .eq('tenant_id', membership.tenantId)
        .maybeSingle(),
      admin
        .from('tenant_stripe_connect_accounts')
        .select('stripe_account_id')
        .eq('tenant_id', membership.tenantId)
        .maybeSingle(),
      admin
        .from('tenant_customer_stripe_customers')
        .select('stripe_customer_id')
        .eq('tenant_id', membership.tenantId)
        .eq('customer_id', customerId)
        .maybeSingle(),
    ]);

  if (planErr || !plan) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Service plan not found or inactive.')}`);
  }
  if (custErr || !cust) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Customer not found.')}`);
  }
  if (connErr || !conn?.stripe_account_id) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Stripe Connect is not linked.')}`);
  }

  const identity = cust.customer_identities as { email: string | null } | null;
  const email = identity?.email?.trim() ?? '';
  if (!link?.stripe_customer_id && !email) {
    redirect(
      `/customers/${customerId}?error=${encodeURIComponent('Add an email on the customer before starting checkout.')}`,
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Stripe is not configured.')}`);
  }

  const origin = getPublicOrigin(membership.tenantSlug);
  const feeBps = parseConnectApplicationFeeBps();
  const applicationFeePercent = subscriptionApplicationFeePercent(feeBps);

  const meta = {
    kind: SUBSCRIPTION_CHECKOUT_KIND,
    tenant_id: membership.tenantId,
    customer_id: customerId,
    service_plan_id: servicePlanId,
  } as const;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      ...(link?.stripe_customer_id
        ? { customer: link.stripe_customer_id }
        : { customer_email: email }),
      line_items: [
        {
          price_data: {
            currency: (plan.currency ?? 'usd').toLowerCase(),
            unit_amount: plan.amount_cents,
            product_data: {
              name: plan.name.trim() || 'Subscription',
            },
            recurring: {
              interval: plan.billing_interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/customers/${customerId}?subscription_checkout=success`,
      cancel_url: `${origin}/customers/${customerId}?subscription_checkout=canceled`,
      metadata: meta,
      subscription_data: {
        metadata: meta,
        ...(applicationFeePercent != null ? { application_fee_percent: applicationFeePercent } : {}),
      },
    },
    { stripeAccount: conn.stripe_account_id },
  );

  if (!session.url) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent('Could not start checkout.')}`);
  }

  redirect(session.url);
}
