import { PLATFORM_TIER_ENTITLEMENTS, type EntitlementFeature } from '@/lib/billing/entitlements';
import { MARKETING_PLAN_ORDER } from '@/lib/billing/marketingPlanCatalog';
import { formatFieldSeatLimit } from '@/lib/billing/teamSeats';
import { TEXT_PACK_PLAN_MESSAGE, TEXT_PACKS } from '@/lib/billing/textPacks';

/** Public pricing pages checked before these figures were written. */
export const COMPETITOR_PRICING_AS_OF = 'Nov 2026';

export const JOBBER_PRICING_URL = 'https://www.getjobber.com/pricing/';
export const HOUSECALL_PRO_PRICING_URL = 'https://www.housecallpro.com/pricing/';

export const NO_ADD_ONS_PATH = '/no-add-ons';

export const NO_ADD_ONS_HEADLINE = 'All features are included in the plan';

export const COMPETITOR_PRICING_DISCLAIMER =
  'Competitor pricing was taken from public pricing pages in Nov 2026 and may change.';

const VARIES = 'Varies, see their site';

export type NoAddOnComparisonRow = {
  feature: string;
  cleanScheduler: string;
  jobber: string;
  housecallPro: string;
};

function plansIncluding(feature: EntitlementFeature): string {
  const names = MARKETING_PLAN_ORDER.filter(
    (tier) => PLATFORM_TIER_ENTITLEMENTS[tier].features[feature],
  ).map((tier) => PLATFORM_TIER_ENTITLEMENTS[tier].displayName);

  if (names.length === 0) return 'Not included';
  if (names.length === MARKETING_PLAN_ORDER.length) return 'All plans';
  if (names.length === 1) return names[0] ?? 'Not included';
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')} and ${last}`;
}

function cleanSchedulerMonthlyPrices(): string {
  return MARKETING_PLAN_ORDER.map((tier) => {
    const plan = PLATFORM_TIER_ENTITLEMENTS[tier];
    return `${plan.displayName} $${plan.monthlyPriceUsd}/mo ($${plan.annualEffectiveMonthlyUsd}/mo annual-effective)`;
  }).join('; ');
}

function cleanSchedulerSeatLine(): string {
  const included = MARKETING_PLAN_ORDER.map((tier) => {
    const plan = PLATFORM_TIER_ENTITLEMENTS[tier];
    const field = formatFieldSeatLimit(plan.limits.includedFieldSeats);
    const fieldLabel = field === 'Unlimited' ? 'unlimited field seats' : `${field} field seats`;
    return `${plan.displayName} includes ${plan.limits.includedOfficeSeats} office seats and ${fieldLabel}`;
  }).join('. ');

  return `No per-user fee. ${included}.`;
}

/** Prepaid text packs are the only charge outside the plan. Copy stays tied to `TEXT_PACKS`. */
export function textPackIncludedNote(): string {
  const small = TEXT_PACKS.pack_1000;
  const large = TEXT_PACKS.pack_2500;
  return `Extra texts are available as prepaid packs: ${small.segmentLabel} segments for ${small.priceLabel}, or ${large.segmentLabel} for ${large.priceLabel}. ${TEXT_PACK_PLAN_MESSAGE}`;
}

/**
 * Comparison cells for the public no-add-ons page.
 * Clean Scheduler cells come from plan entitlements.
 * Competitor cells use only figures confirmed on the public pricing pages in Nov 2026.
 */
export function buildNoAddOnComparison(): NoAddOnComparisonRow[] {
  return [
    {
      feature: 'Monthly price',
      cleanScheduler: cleanSchedulerMonthlyPrices(),
      jobber:
        'Core $49/mo billed monthly, or $29/mo billed annually. Other plan prices vary, see their site.',
      housecallPro:
        'Basic $79/mo, Essentials $189/mo, and Max $329/mo. Billed annually: $59/mo, $149/mo, and $299/mo.',
    },
    {
      feature: 'Per-user fees',
      cleanScheduler: cleanSchedulerSeatLine(),
      jobber: 'Extra users $29/mo each.',
      housecallPro:
        'Max includes 8 users, then $35/mo per additional user. Basic lists 1 user included and Essentials lists 5. Those cards do not state an extra-user price.',
    },
    {
      feature: 'Route optimization',
      cleanScheduler: plansIncluding('routeReoptimization'),
      jobber: VARIES,
      housecallPro: 'Max',
    },
    {
      feature: 'Multi-cleaner dispatch',
      cleanScheduler: plansIncluding('multiCleanerDispatch'),
      jobber: VARIES,
      housecallPro: VARIES,
    },
    {
      feature: 'Online booking',
      cleanScheduler: plansIncluding('publicBookingRequest'),
      jobber: VARIES,
      housecallPro: VARIES,
    },
  ];
}
