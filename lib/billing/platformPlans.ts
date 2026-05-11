import { serverEnv } from '@/lib/env';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
export {
  parsePlatformPlanTier,
  PLATFORM_PLAN_LABELS,
  PLATFORM_PLAN_DESCRIPTIONS,
} from '@/lib/billing/platformPlanTier';

/**
 * Resolves Stripe Price ID for the platform subscription tier.
 * Falls back to deprecated STRIPE_PLATFORM_PRICE_ID when a tier-specific id is unset.
 */
export function resolvePlatformPriceId(tier: PlatformPlanTier): string | null {
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
  const legacy = serverEnv.STRIPE_PLATFORM_PRICE_ID?.trim();
  if (starter && id === starter) return 'starter';
  if (business && id === business) return 'business';
  if (pro && id === pro) return 'pro';
  if (legacy && id === legacy) return null;
  return null;
}
