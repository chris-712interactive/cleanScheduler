import { getStripe } from '@/lib/stripe/server';
import {
  resolvePlatformPriceId,
  type PlatformCheckoutKind,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlans';

const TRIAL_DAYS = 7;

export type { PlatformCheckoutKind } from '@/lib/billing/platformPlans';

export interface PlatformCheckoutParams {
  tenantId: string;
  tenantSlug: string;
  customerEmail: string;
  platformPlan: PlatformPlanTier;
  /** Full URL to tenant portal after successful Checkout */
  successUrl: string;
  /** Full URL if user cancels Checkout */
  cancelUrl: string;
  /** `trial_signup` (default): 7-day trial, card optional. `subscribe`: paid subscription, card required. */
  kind?: PlatformCheckoutKind;
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
  const kind = params.kind ?? 'trial_signup';
  const priceId = resolvePlatformPriceId(params.platformPlan, kind);
  if (!stripe || !priceId) return null;
  const isSubscribe = kind === 'subscribe';
  const existingCustomerId = params.stripeCustomerId?.trim() || null;

  const subscriptionMetadata = {
    tenant_id: params.tenantId,
    tenant_slug: params.tenantSlug,
    platform_plan: params.platformPlan,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: params.customerEmail }),
    payment_method_collection: isSubscribe ? 'always' : 'if_required',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: isSubscribe
      ? {
          metadata: subscriptionMetadata,
          // Paid conversion — no trial. If Stripe still shows a trial, the Price object in
          // Dashboard likely has a default trial; use a non-trial Price ID for subscribe.
        }
      : {
          trial_period_days: TRIAL_DAYS,
          trial_settings: {
            end_behavior: {
              // If no payment method is added during trial, end access cleanly.
              missing_payment_method: 'cancel',
            },
          },
          metadata: subscriptionMetadata,
        },
    metadata: {
      ...subscriptionMetadata,
      checkout_kind: kind,
    },
    success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}checkout=success`,
    cancel_url: params.cancelUrl,
  });

  return session.url;
}
