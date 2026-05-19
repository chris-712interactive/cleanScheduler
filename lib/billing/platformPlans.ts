import { serverEnv } from '@/lib/env';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export type PlatformCheckoutKind = 'trial_signup' | 'subscribe';

export type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
export {
  parsePlatformPlanTier,
  PLATFORM_PLAN_LABELS,
  PLATFORM_PLAN_DESCRIPTIONS,
} from '@/lib/billing/platformPlanTier';

function resolveSubscribePriceId(tier: PlatformPlanTier): string | null {
  switch (tier) {
    case 'starter':
      return serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE?.trim() || null;
    case 'pro':
      return serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE?.trim() || null;
    case 'business':
      return serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE?.trim() || null;
    default:
      return null;
  }
}

/**
 * Resolves Stripe Price ID for the platform subscription tier.
 * Falls back to deprecated STRIPE_PLATFORM_PRICE_ID when a tier-specific id is unset.
 *
 * For `subscribe` (post-trial paid checkout), prefers `STRIPE_PLATFORM_PRICE_*_SUBSCRIBE`
 * when set — use a Price in Stripe **without** a default free trial.
 */
export function resolvePlatformPriceId(
  tier: PlatformPlanTier,
  kind: PlatformCheckoutKind = 'trial_signup',
): string | null {
  if (kind === 'subscribe') {
    const subscribePrice = resolveSubscribePriceId(tier);
    if (subscribePrice) return subscribePrice;
  }

  const legacy = serverEnv.STRIPE_PLATFORM_PRICE_ID?.trim() || null;
  switch (tier) {
    case 'starter':
      return serverEnv.STRIPE_PLATFORM_PRICE_STARTER?.trim() || legacy;
    case 'pro':
      return serverEnv.STRIPE_PLATFORM_PRICE_PRO?.trim() || legacy;
    case 'business':
      return serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS?.trim() || legacy;
    default:
      return legacy;
  }
}

/**
 * Maps a Stripe recurring Price ID to a platform tier (for webhook sync when
 * subscription metadata omits platform_plan).
 */
export function resolvePlatformTierFromStripePriceId(
  priceId: string | null | undefined,
): PlatformPlanTier | null {
  const id = priceId?.trim();
  if (!id) return null;
  const starter = serverEnv.STRIPE_PLATFORM_PRICE_STARTER?.trim();
  const business = serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS?.trim();
  const pro = serverEnv.STRIPE_PLATFORM_PRICE_PRO?.trim();
  const starterSub = serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE?.trim();
  const businessSub = serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE?.trim();
  const proSub = serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE?.trim();
  const legacy = serverEnv.STRIPE_PLATFORM_PRICE_ID?.trim();
  if (starter && id === starter) return 'starter';
  if (starterSub && id === starterSub) return 'starter';
  if (business && id === business) return 'business';
  if (businessSub && id === businessSub) return 'business';
  if (pro && id === pro) return 'pro';
  if (proSub && id === proSub) return 'pro';
  if (legacy && id === legacy) return null;
  return null;
}
