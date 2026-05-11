import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';
import { serverEnv } from '@/lib/env';
import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { resolvePlatformTierFromStripePriceId } from '@/lib/billing/platformPlans';
import { processStripeWebhookEventOnce } from '@/lib/stripe/webhookIdempotency';
import type { Database } from '@/lib/supabase/database.types';

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): Database['public']['Enums']['tenant_billing_status'] {
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

function subscriptionPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

async function syncTenantFromSubscription(
  admin: SupabaseClient<Database>,
  subscription: Stripe.Subscription,
): Promise<void> {
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

  let platformPlan: PlatformPlanTier | undefined =
    parsePlatformPlanTier(String(subscription.metadata?.platform_plan ?? '')) ?? undefined;
  if (!platformPlan) {
    const priceId = subscriptionPrimaryPriceId(subscription);
    platformPlan = resolvePlatformTierFromStripePriceId(priceId) ?? undefined;
  }

  const mappedStatus = mapStripeSubscriptionStatus(subscription.status);
  const isCanceled = mappedStatus === 'canceled';
  const nowIso = new Date().toISOString();

  const updatePayload: Database['public']['Tables']['tenant_billing_accounts']['Update'] = {
    stripe_subscription_id: isCanceled ? null : subscription.id,
    stripe_customer_id: customerId ?? null,
    status: mappedStatus,
    trial_started_at: trialStart,
    trial_ends_at: trialEnd,
    canceled_at: isCanceled ? nowIso : null,
  };
  if (platformPlan) {
    updatePayload.platform_plan = platformPlan;
  }

  await admin.from('tenant_billing_accounts').update(updatePayload).eq('tenant_id', tenantId);

  await admin.from('tenants').update({ is_active: !isCanceled }).eq('id', tenantId);
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

  const admin = createAdminClient();

  try {
    await processStripeWebhookEventOnce(admin, event, async () => {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== 'subscription') break;

          const tenantId = session.metadata?.tenant_id;
          const subId = session.subscription;
          if (!tenantId || typeof subId !== 'string') break;

          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncTenantFromSubscription(admin, subscription);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await syncTenantFromSubscription(admin, subscription);
          break;
        }
        default:
          break;
      }
    });
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
