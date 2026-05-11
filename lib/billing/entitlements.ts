import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';

export type EntitlementFeature =
  | 'rolePermissions'
  | 'jobCosting'
  | 'customerPortal'
  | 'campaigns'
  | 'advancedAnalytics'
  | 'forecasting'
  | 'fullApiWebhooks'
  | 'multiLocationControls'
  | 'dedicatedOnboarding';

export type EntitlementLimitKey =
  | 'includedSeats'
  | 'maxActiveCustomers'
  | 'maxAutomationWorkflows'
  | 'includedSmsCreditsMonthly'
  | 'includedEmailCreditsMonthly'
  | 'includedIntegrations';

export interface PlanEntitlements {
  plan: PlatformPlanTier;
  displayName: string;
  monthlyPriceUsd: number;
  annualEffectiveMonthlyUsd: number;
  features: Record<EntitlementFeature, boolean>;
  limits: Record<EntitlementLimitKey, number>;
}

/**
 * Single source of truth for cleanScheduler feature gates + soft limits.
 * Keep this aligned with product packaging and Stripe plan copy.
 */
export const PLATFORM_TIER_ENTITLEMENTS: Record<PlatformPlanTier, PlanEntitlements> = {
  starter: {
    plan: 'starter',
    displayName: 'Starter',
    monthlyPriceUsd: 39,
    annualEffectiveMonthlyUsd: 31,
    features: {
      rolePermissions: false,
      jobCosting: false,
      customerPortal: false,
      campaigns: false,
      advancedAnalytics: false,
      forecasting: false,
      fullApiWebhooks: false,
      multiLocationControls: false,
      dedicatedOnboarding: false,
    },
    limits: {
      includedSeats: 1,
      maxActiveCustomers: 500,
      maxAutomationWorkflows: 3,
      includedSmsCreditsMonthly: 500,
      includedEmailCreditsMonthly: 2500,
      includedIntegrations: 1,
    },
  },
  business: {
    plan: 'business',
    displayName: 'Business',
    monthlyPriceUsd: 129,
    annualEffectiveMonthlyUsd: 103,
    features: {
      rolePermissions: true,
      jobCosting: true,
      customerPortal: true,
      campaigns: true,
      advancedAnalytics: false,
      forecasting: false,
      fullApiWebhooks: false,
      multiLocationControls: false,
      dedicatedOnboarding: false,
    },
    limits: {
      includedSeats: 5,
      maxActiveCustomers: 5000,
      maxAutomationWorkflows: 20,
      includedSmsCreditsMonthly: 5000,
      includedEmailCreditsMonthly: 25000,
      includedIntegrations: 5,
    },
  },
  pro: {
    plan: 'pro',
    displayName: 'Pro',
    monthlyPriceUsd: 299,
    annualEffectiveMonthlyUsd: 239,
    features: {
      rolePermissions: true,
      jobCosting: true,
      customerPortal: true,
      campaigns: true,
      advancedAnalytics: true,
      forecasting: true,
      fullApiWebhooks: true,
      multiLocationControls: true,
      dedicatedOnboarding: true,
    },
    limits: {
      includedSeats: 10,
      maxActiveCustomers: 25000,
      maxAutomationWorkflows: 100,
      includedSmsCreditsMonthly: 25000,
      includedEmailCreditsMonthly: 100000,
      includedIntegrations: 20,
    },
  },
};

export function getEntitlementsForTier(tier: PlatformPlanTier): PlanEntitlements {
  return PLATFORM_TIER_ENTITLEMENTS[tier];
}

export function isFeatureEnabled(tier: PlatformPlanTier, feature: EntitlementFeature): boolean {
  return PLATFORM_TIER_ENTITLEMENTS[tier].features[feature];
}

export function getTierLimit(tier: PlatformPlanTier, limit: EntitlementLimitKey): number {
  return PLATFORM_TIER_ENTITLEMENTS[tier].limits[limit];
}

export class EntitlementGateError extends Error {
  constructor(message: string, public readonly code: 'feature_blocked' | 'limit_exceeded') {
    super(message);
    this.name = 'EntitlementGateError';
  }
}

export function assertFeatureEnabled(tier: PlatformPlanTier, feature: EntitlementFeature): void {
  if (isFeatureEnabled(tier, feature)) return;
  const planName = PLATFORM_TIER_ENTITLEMENTS[tier].displayName;
  throw new EntitlementGateError(
    `${planName} does not include this capability. Upgrade your subscription to continue.`,
    'feature_blocked',
  );
}

export function assertLimitNotExceeded(
  tier: PlatformPlanTier,
  limit: EntitlementLimitKey,
  currentValue: number,
): void {
  const allowed = getTierLimit(tier, limit);
  if (currentValue < allowed) return;

  const planName = PLATFORM_TIER_ENTITLEMENTS[tier].displayName;
  throw new EntitlementGateError(
    `${planName} allows up to ${allowed} for ${limit}. Upgrade or purchase an add-on to continue.`,
    'limit_exceeded',
  );
}

export async function resolveTenantPlanTier(
  // Database typing is still scaffolded in bootstrap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tenantId: string,
): Promise<PlatformPlanTier> {
  const { data } = await admin
    .from('tenant_billing_accounts')
    .select('platform_plan')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return parsePlatformPlanTier(data?.platform_plan) ?? 'starter';
}

export async function resolveTenantEntitlements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tenantId: string,
): Promise<PlanEntitlements> {
  const tier = await resolveTenantPlanTier(admin, tenantId);
  return getEntitlementsForTier(tier);
}
