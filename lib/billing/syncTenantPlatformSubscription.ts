import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import {
  parsePlatformBillingInterval,
  resolvePlatformIntervalFromStripePriceId,
  resolvePlatformTierFromStripePriceId,
} from '@/lib/billing/platformPlans';
import type { Database } from '@/lib/supabase/database.types';
import { revokePlaidBankLink } from '@/lib/plaid/revokePlaidBankLink';

type Admin = SupabaseClient<Database>;

export function resolveStripeResourceId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id ?? null;
}

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

function subscriptionPrimaryPrice(subscription: Stripe.Subscription): Stripe.Price | null {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? null : price;
}

function subscriptionPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscriptionPrimaryPrice(subscription);
  return price?.id ?? null;
}

async function resolveTenantIdForSubscription(
  admin: Admin,
  subscription: Stripe.Subscription,
  hints?: { tenantId?: string | null; stripeCustomerId?: string | null },
): Promise<string | null> {
  const fromHint = hints?.tenantId?.trim();
  if (fromHint) return fromHint;

  const fromMeta = subscription.metadata?.tenant_id?.trim();
  if (fromMeta) return fromMeta;

  const subId = subscription.id;
  const { data: bySub } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();
  if (bySub?.tenant_id) return bySub.tenant_id;

  const customerId =
    hints?.stripeCustomerId?.trim() ||
    resolveStripeResourceId(
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    );
  if (!customerId) return null;

  const { data: byCustomer } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return byCustomer?.tenant_id ?? null;
}

/**
 * Writes platform subscription state from Stripe into tenant_billing_accounts + tenants.
 */
export async function syncTenantFromStripeSubscription(
  admin: Admin,
  subscription: Stripe.Subscription,
  hints?: { tenantId?: string | null; stripeCustomerId?: string | null },
): Promise<boolean> {
  const tenantId = await resolveTenantIdForSubscription(admin, subscription, hints);
  if (!tenantId) {
    console.error(
      '[syncTenantPlatformSubscription] No tenant for subscription',
      subscription.id,
      subscription.metadata,
    );
    return false;
  }

  const customerId = resolveStripeResourceId(
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
  );

  const trialStart = subscription.trial_start
    ? new Date(subscription.trial_start * 1000).toISOString()
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  let platformPlan: PlatformPlanTier | undefined =
    parsePlatformPlanTier(String(subscription.metadata?.platform_plan ?? '')) ?? undefined;
  const priceId = subscriptionPrimaryPriceId(subscription);
  const priceObject = subscriptionPrimaryPrice(subscription);
  if (!platformPlan) {
    platformPlan = resolvePlatformTierFromStripePriceId(priceId) ?? undefined;
  }

  let billingInterval =
    parsePlatformBillingInterval(String(subscription.metadata?.billing_interval ?? '')) ??
    undefined;
  if (!billingInterval) {
    billingInterval =
      resolvePlatformIntervalFromStripePriceId(priceId) ??
      (priceObject?.recurring?.interval === 'year'
        ? 'year'
        : priceObject?.recurring?.interval === 'month'
          ? 'month'
          : undefined);
  }

  const mappedStatus = mapStripeSubscriptionStatus(subscription.status);
  const isCanceled = mappedStatus === 'canceled';
  const nowIso = new Date().toISOString();

  const { data: existingBilling } = await admin
    .from('tenant_billing_accounts')
    .select('activated_at, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const wasAlreadyCanceled = existingBilling?.status === 'canceled';

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
  if (billingInterval) {
    updatePayload.billing_interval = billingInterval;
  }
  if (mappedStatus === 'active' && !isCanceled && !existingBilling?.activated_at) {
    updatePayload.activated_at = nowIso;
  }

  const { error: billingError } = await admin
    .from('tenant_billing_accounts')
    .update(updatePayload)
    .eq('tenant_id', tenantId);

  if (billingError) {
    throw new Error(`tenant_billing_accounts update failed: ${billingError.message}`);
  }

  const { error: tenantError } = await admin
    .from('tenants')
    .update({ is_active: !isCanceled })
    .eq('id', tenantId);

  if (tenantError) {
    throw new Error(`tenants update failed: ${tenantError.message}`);
  }

  if (isCanceled && !wasAlreadyCanceled) {
    try {
      await revokePlaidBankLink(admin, tenantId, { reason: 'subscription_canceled' });
    } catch (error) {
      console.error('[syncTenantPlatformSubscription] Plaid revoke failed', tenantId, error);
    }
  }

  return true;
}

/**
 * After Checkout success or when webhooks are delayed — pull the latest subscription from Stripe.
 */
export async function syncTenantPlatformBillingFromStripe(
  admin: Admin,
  tenantId: string,
): Promise<{ synced: boolean; reason?: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return { synced: false, reason: 'Stripe is not configured.' };
  }

  const { data: billing, error } = await admin
    .from('tenant_billing_accounts')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !billing) {
    return { synced: false, reason: 'Billing record not found.' };
  }

  let customerId = billing.stripe_customer_id?.trim() || null;

  if (!customerId) {
    const { data: profile } = await admin
      .from('tenant_onboarding_profiles')
      .select('owner_email')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const ownerEmail = profile?.owner_email?.trim().toLowerCase();
    if (ownerEmail) {
      const customers = await stripe.customers.list({ email: ownerEmail, limit: 5 });
      customerId = customers.data[0]?.id ?? null;
      if (customerId) {
        await admin
          .from('tenant_billing_accounts')
          .update({ stripe_customer_id: customerId })
          .eq('tenant_id', tenantId);
      }
    }
  }

  if (!customerId) {
    return { synced: false, reason: 'No Stripe customer on file yet.' };
  }

  const existingSubId = billing.stripe_subscription_id?.trim();
  if (existingSubId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(existingSubId);
      await syncTenantFromStripeSubscription(admin, subscription, {
        tenantId,
        stripeCustomerId: customerId,
      });
      return { synced: true };
    } catch {
      // Fall through to list by customer.
    }
  }

  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  const preferred =
    list.data.find((s) => s.status === 'active' || s.status === 'trialing') ?? list.data[0];

  if (!preferred) {
    return { synced: false, reason: 'No Stripe subscription found for this customer.' };
  }

  await syncTenantFromStripeSubscription(admin, preferred, {
    tenantId,
    stripeCustomerId: customerId,
  });
  return { synced: true };
}

export async function syncTenantFromCheckoutSession(
  admin: Admin,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.mode !== 'subscription') return false;

  const tenantId = session.metadata?.tenant_id?.trim();
  const subId = resolveStripeResourceId(session.subscription);
  if (!tenantId || !subId) {
    console.error(
      '[syncTenantPlatformSubscription] checkout.session.completed missing tenant or subscription',
      { tenantId, subId, sessionId: session.id },
    );
    return false;
  }

  const subscription = await stripe.subscriptions.retrieve(subId);
  return syncTenantFromStripeSubscription(admin, subscription, {
    tenantId,
    stripeCustomerId: resolveStripeResourceId(session.customer),
  });
}
