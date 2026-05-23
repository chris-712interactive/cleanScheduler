import { unstable_cache } from 'next/cache';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import {
  getMarketingFeatureBullets,
  MARKETING_MOST_POPULAR_TIER,
  MARKETING_PLAN_ORDER,
} from '@/lib/billing/marketingPlanCatalog';
import {
  PLATFORM_PLAN_DESCRIPTIONS,
  type PlatformPlanTier,
} from '@/lib/billing/platformPlanTier';
import { resolvePlatformPriceId } from '@/lib/billing/platformPlans';
import { getStripe } from '@/lib/stripe/server';

export type PlatformPricingTier = {
  tier: PlatformPlanTier;
  displayName: string;
  description: string;
  monthlyPriceUsd: number;
  annualEffectiveMonthlyUsd: number;
  featureBullets: string[];
  isMostPopular: boolean;
  limits: {
    includedOfficeSeats: number;
    includedFieldSeats: number | null;
    maxActiveCustomers: number;
  };
  priceSource: 'stripe' | 'entitlements';
};

async function fetchStripeMonthlyPriceUsd(priceId: string): Promise<number | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount == null) return null;

    if (price.recurring?.interval === 'year') {
      return price.unit_amount / 100 / 12;
    }

    return price.unit_amount / 100;
  } catch {
    return null;
  }
}

async function resolveTierPricing(tier: PlatformPlanTier): Promise<PlatformPricingTier> {
  const entitlements = PLATFORM_TIER_ENTITLEMENTS[tier];
  const priceId =
    resolvePlatformPriceId(tier, { interval: 'month' }) ??
    resolvePlatformPriceId(tier, { interval: 'year' });

  let monthlyPriceUsd = entitlements.monthlyPriceUsd;
  let priceSource: PlatformPricingTier['priceSource'] = 'entitlements';

  if (priceId) {
    const stripePrice = await fetchStripeMonthlyPriceUsd(priceId);
    if (stripePrice != null) {
      monthlyPriceUsd = stripePrice;
      priceSource = 'stripe';
    }
  }

  return {
    tier,
    displayName: entitlements.displayName,
    description: PLATFORM_PLAN_DESCRIPTIONS[tier],
    monthlyPriceUsd,
    annualEffectiveMonthlyUsd: entitlements.annualEffectiveMonthlyUsd,
    featureBullets: getMarketingFeatureBullets(tier),
    isMostPopular: tier === MARKETING_MOST_POPULAR_TIER,
    limits: {
      includedOfficeSeats: entitlements.limits.includedOfficeSeats,
      includedFieldSeats: entitlements.limits.includedFieldSeats,
      maxActiveCustomers: entitlements.limits.maxActiveCustomers,
    },
    priceSource,
  };
}

async function fetchPlatformPricing(): Promise<PlatformPricingTier[]> {
  return Promise.all(MARKETING_PLAN_ORDER.map((tier) => resolveTierPricing(tier)));
}

const getCachedPlatformPricing = unstable_cache(
  fetchPlatformPricing,
  ['platform-pricing-display'],
  { revalidate: 3600 },
);

export async function getPlatformPricingDisplay(): Promise<PlatformPricingTier[]> {
  return getCachedPlatformPricing();
}

export function formatPlanPriceUsd(amount: number, options?: { showCents?: boolean }): string {
  const showCents = options?.showCents ?? amount % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}
