import { serverEnv } from '@/lib/env';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export type PlatformBillingInterval = 'month' | 'year';

/** @deprecated DB-only trials no longer use Stripe at signup. */
export type PlatformCheckoutKind = 'trial_signup' | 'subscribe';

export type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
export {
  parsePlatformPlanTier,
  PLATFORM_PLAN_LABELS,
  PLATFORM_PLAN_DESCRIPTIONS,
} from '@/lib/billing/platformPlanTier';

export interface ResolvePlatformPriceOptions {
  interval?: PlatformBillingInterval;
  /** @deprecated Use interval; kept for legacy callers. */
  kind?: PlatformCheckoutKind;
}

function resolveMonthlyPriceId(tier: PlatformPlanTier): string | null {
  switch (tier) {
    case 'starter':
      return (
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER_MONTHLY?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER?.trim() ||
        null
      );
    case 'business':
      return (
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_MONTHLY?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS?.trim() ||
        null
      );
    case 'pro':
      return (
        serverEnv.STRIPE_PLATFORM_PRICE_PRO_MONTHLY?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE?.trim() ||
        serverEnv.STRIPE_PLATFORM_PRICE_PRO?.trim() ||
        null
      );
    default:
      return null;
  }
}

function resolveYearlyPriceId(tier: PlatformPlanTier): string | null {
  switch (tier) {
    case 'starter':
      return serverEnv.STRIPE_PLATFORM_PRICE_STARTER_YEARLY?.trim() || null;
    case 'business':
      return serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_YEARLY?.trim() || null;
    case 'pro':
      return serverEnv.STRIPE_PLATFORM_PRICE_PRO_YEARLY?.trim() || null;
    default:
      return null;
  }
}

/**
 * Resolves Stripe Price ID for the platform subscription tier and billing interval.
 * Falls back to deprecated STRIPE_PLATFORM_PRICE_* / *_SUBSCRIBE for monthly when unset.
 */
export function resolvePlatformPriceId(
  tier: PlatformPlanTier,
  options: ResolvePlatformPriceOptions = {},
): string | null {
  const interval = options.interval ?? 'month';
  const priceId = interval === 'year' ? resolveYearlyPriceId(tier) : resolveMonthlyPriceId(tier);
  if (priceId) return priceId;

  return serverEnv.STRIPE_PLATFORM_PRICE_ID?.trim() || null;
}

export function parsePlatformBillingInterval(
  raw: string | null | undefined,
): PlatformBillingInterval | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'month' || v === 'monthly') return 'month';
  if (v === 'year' || v === 'yearly' || v === 'annual') return 'year';
  return null;
}

const ALL_CONFIGURED_PRICE_IDS = (): string[] => {
  const ids = [
    serverEnv.STRIPE_PLATFORM_PRICE_ID,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_YEARLY,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_YEARLY,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_YEARLY,
  ];
  return ids.map((id) => id?.trim()).filter(Boolean) as string[];
};

/**
 * Maps a Stripe recurring Price ID to a platform tier (for webhook sync when
 * subscription metadata omits platform_plan).
 */
export function resolvePlatformTierFromStripePriceId(
  priceId: string | null | undefined,
): PlatformPlanTier | null {
  const id = priceId?.trim();
  if (!id) return null;

  const pairs: [PlatformPlanTier, (string | undefined)[]][] = [
    [
      'starter',
      [
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER,
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE,
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER_MONTHLY,
        serverEnv.STRIPE_PLATFORM_PRICE_STARTER_YEARLY,
      ],
    ],
    [
      'business',
      [
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS,
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE,
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_MONTHLY,
        serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_YEARLY,
      ],
    ],
    [
      'pro',
      [
        serverEnv.STRIPE_PLATFORM_PRICE_PRO,
        serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE,
        serverEnv.STRIPE_PLATFORM_PRICE_PRO_MONTHLY,
        serverEnv.STRIPE_PLATFORM_PRICE_PRO_YEARLY,
      ],
    ],
  ];

  for (const [tier, candidates] of pairs) {
    if (candidates.some((candidate) => candidate?.trim() === id)) {
      return tier;
    }
  }

  const legacy = serverEnv.STRIPE_PLATFORM_PRICE_ID?.trim();
  if (legacy && id === legacy) return null;

  if (ALL_CONFIGURED_PRICE_IDS().includes(id)) {
    return null;
  }

  return null;
}

export function resolvePlatformIntervalFromStripePriceId(
  priceId: string | null | undefined,
): PlatformBillingInterval | null {
  const id = priceId?.trim();
  if (!id) return null;

  const yearlyIds = [
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_YEARLY,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_YEARLY,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_YEARLY,
  ];
  if (yearlyIds.some((candidate) => candidate?.trim() === id)) {
    return 'year';
  }

  const monthlyIds = [
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_STARTER_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_BUSINESS_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_SUBSCRIBE,
    serverEnv.STRIPE_PLATFORM_PRICE_PRO_MONTHLY,
    serverEnv.STRIPE_PLATFORM_PRICE_ID,
  ];
  if (monthlyIds.some((candidate) => candidate?.trim() === id)) {
    return 'month';
  }

  return null;
}
