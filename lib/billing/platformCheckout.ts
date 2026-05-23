import { getStripe } from '@/lib/stripe/server';
import {
  resolvePlatformPriceId,
  type PlatformBillingInterval,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlans';

export type { PlatformBillingInterval, PlatformCheckoutKind } from '@/lib/billing/platformPlans';

export interface PlatformCheckoutParams {
  tenantId: string;
  tenantSlug: string;
  customerEmail: string;
  platformPlan: PlatformPlanTier;
  billingInterval?: PlatformBillingInterval;
  /** Full URL to tenant portal after successful Checkout */
  successUrl: string;
  /** Full URL if user cancels Checkout */
  cancelUrl: string;
  /** Reuse an existing Stripe customer when resubscribing after trial. */
  stripeCustomerId?: string | null;
}

/**
 * Stripe Checkout for cleanScheduler platform subscription (tenant pays you).
 * Returns checkout URL, or null when Stripe / price id is not configured for this tier.
 */
export async function createPlatformSubscriptionCheckoutUrl(
  params: PlatformCheckoutParams,
): Promise<string | null> {
  const stripe = getStripe();
  const billingInterval = params.billingInterval ?? 'month';
  const priceId = resolvePlatformPriceId(params.platformPlan, { interval: billingInterval });
  if (!stripe || !priceId) return null;
  const existingCustomerId = params.stripeCustomerId?.trim() || null;

  const subscriptionMetadata = {
    tenant_id: params.tenantId,
    tenant_slug: params.tenantSlug,
    platform_plan: params.platformPlan,
    billing_interval: billingInterval,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: params.customerEmail }),
    payment_method_collection: 'always',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: subscriptionMetadata,
    },
    metadata: {
      ...subscriptionMetadata,
      checkout_kind: 'subscribe',
    },
    success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}checkout=success`,
    cancel_url: params.cancelUrl,
  });

  return session.url;
}
