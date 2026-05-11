import { getStripe } from '@/lib/stripe/server';
import { resolvePlatformPriceId, type PlatformPlanTier } from '@/lib/billing/platformPlans';

const TRIAL_DAYS = 7;

export interface PlatformCheckoutParams {
  tenantId: string;
  tenantSlug: string;
  customerEmail: string;
  platformPlan: PlatformPlanTier;
  /** Full URL to tenant portal after successful Checkout */
  successUrl: string;
  /** Full URL if user cancels Checkout */
  cancelUrl: string;
}

/**
 * Stripe Checkout for cleanScheduler platform subscription (tenant pays you).
 * Returns checkout URL, or null when Stripe / price id is not configured for this tier.
 */
export async function createPlatformSubscriptionCheckoutUrl(
  params: PlatformCheckoutParams,
): Promise<string | null> {
  const stripe = getStripe();
  const priceId = resolvePlatformPriceId(params.platformPlan);
  if (!stripe || !priceId) return null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.customerEmail,
    // Allow trial signup without collecting a card at checkout.
    payment_method_collection: 'if_required',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      trial_settings: {
        end_behavior: {
          // If no payment method is added during trial, end access cleanly.
          missing_payment_method: 'cancel',
        },
      },
      metadata: {
        tenant_id: params.tenantId,
        tenant_slug: params.tenantSlug,
        platform_plan: params.platformPlan,
      },
    },
    metadata: {
      tenant_id: params.tenantId,
      tenant_slug: params.tenantSlug,
      platform_plan: params.platformPlan,
    },
    success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}checkout=success`,
    cancel_url: params.cancelUrl,
  });

  return session.url;
}
