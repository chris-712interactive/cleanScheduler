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
