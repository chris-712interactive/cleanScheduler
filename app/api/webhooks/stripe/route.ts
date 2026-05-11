import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';
import { serverEnv } from '@/lib/env';
import { parsePlatformPlanTier } from '@/lib/billing/platformPlanTier';

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'trialing' | 'active' | 'past_due' | 'canceled' {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'trialing';
    case 'paused':
      return 'active';
    default:
      return 'trialing';
  }
}

async function syncTenantFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();

  let tenantId = subscription.metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    const { data } = await admin
      .from('tenant_billing_accounts')
      .select('tenant_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    tenantId = data?.tenant_id;
  }
  if (!tenantId) return;

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const trialStart = subscription.trial_start
    ? new Date(subscription.trial_start * 1000).toISOString()
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  const platformPlan = parsePlatformPlanTier(String(subscription.metadata?.platform_plan ?? ''));

  const patch: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId ?? null,
    status: mapStripeSubscriptionStatus(subscription.status),
    trial_started_at: trialStart,
    trial_ends_at: trialEnd,
  };
  if (platformPlan) {
    patch.platform_plan = platformPlan;
  }

  await admin.from('tenant_billing_accounts').update(patch).eq('tenant_id', tenantId);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = serverEnv.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 501 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const tenantId = session.metadata?.tenant_id;
        const subId = session.subscription;
        if (!tenantId || typeof subId !== 'string') break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        await syncTenantFromSubscription(subscription);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncTenantFromSubscription(subscription);
        break;
      }
      default:
        break;
    }
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
