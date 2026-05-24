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
  /** Monthly recurring amount from Stripe monthly Price (or entitlements fallback). */
  monthlyPriceUsd: number;
  /** Total yearly charge from Stripe yearly Price (or entitlements fallback). */
  annualPriceUsd: number;
  /** Monthly equivalent when billed yearly (`annualPriceUsd / 12`). */
  annualEffectiveMonthlyUsd: number;
  featureBullets: string[];
  isMostPopular: boolean;
  limits: {
    includedOfficeSeats: number;
    includedFieldSeats: number | null;
    maxActiveCustomers: number;
  };
  monthlyPriceSource: 'stripe' | 'entitlements';
  annualPriceSource: 'stripe' | 'entitlements';
  /** True when either interval price came from Stripe. */
  priceSource: 'stripe' | 'entitlements';
};

type StripePriceQuote = {
  amountUsd: number;
  interval: 'month' | 'year';
};

async function fetchStripePriceQuote(priceId: string): Promise<StripePriceQuote | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount == null) return null;

    const interval = price.recurring?.interval === 'year' ? 'year' : 'month';
    return {
      amountUsd: price.unit_amount / 100,
      interval,
    };
  } catch {
    return null;
  }
}

export function computeAnnualSavingsPercent(
  monthlyPriceUsd: number,
  annualEffectiveMonthlyUsd: number,
): number {
  if (monthlyPriceUsd <= 0 || annualEffectiveMonthlyUsd >= monthlyPriceUsd) return 0;
  return Math.round(((monthlyPriceUsd - annualEffectiveMonthlyUsd) / monthlyPriceUsd) * 100);
}

async function resolveTierPricing(tier: PlatformPlanTier): Promise<PlatformPricingTier> {
  const entitlements = PLATFORM_TIER_ENTITLEMENTS[tier];
  const monthlyPriceId = resolvePlatformPriceId(tier, { interval: 'month' });
  const yearlyPriceId = resolvePlatformPriceId(tier, { interval: 'year' });

  let monthlyPriceUsd = entitlements.monthlyPriceUsd;
  let annualPriceUsd = entitlements.annualEffectiveMonthlyUsd * 12;
  let annualEffectiveMonthlyUsd = entitlements.annualEffectiveMonthlyUsd;
  let monthlyPriceSource: PlatformPricingTier['monthlyPriceSource'] = 'entitlements';
  let annualPriceSource: PlatformPricingTier['annualPriceSource'] = 'entitlements';

  if (monthlyPriceId) {
    const quote = await fetchStripePriceQuote(monthlyPriceId);
    if (quote?.interval === 'month') {
      monthlyPriceUsd = quote.amountUsd;
      monthlyPriceSource = 'stripe';
    }
  }

  if (yearlyPriceId) {
    const quote = await fetchStripePriceQuote(yearlyPriceId);
    if (quote?.interval === 'year') {
      annualPriceUsd = quote.amountUsd;
      annualEffectiveMonthlyUsd = quote.amountUsd / 12;
      annualPriceSource = 'stripe';
    }
  }

  return {
    tier,
    displayName: entitlements.displayName,
    description: PLATFORM_PLAN_DESCRIPTIONS[tier],
    monthlyPriceUsd,
    annualPriceUsd,
    annualEffectiveMonthlyUsd,
    featureBullets: getMarketingFeatureBullets(tier),
    isMostPopular: tier === MARKETING_MOST_POPULAR_TIER,
    limits: {
      includedOfficeSeats: entitlements.limits.includedOfficeSeats,
      includedFieldSeats: entitlements.limits.includedFieldSeats,
      maxActiveCustomers: entitlements.limits.maxActiveCustomers,
    },
    monthlyPriceSource,
    annualPriceSource,
    priceSource:
      monthlyPriceSource === 'stripe' || annualPriceSource === 'stripe'
        ? 'stripe'
        : 'entitlements',
  };
}

async function fetchPlatformPricing(): Promise<PlatformPricingTier[]> {
  return Promise.all(MARKETING_PLAN_ORDER.map((tier) => resolveTierPricing(tier)));
}

const getCachedPlatformPricing = unstable_cache(
  fetchPlatformPricing,
  ['platform-pricing-display-v2'],
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
