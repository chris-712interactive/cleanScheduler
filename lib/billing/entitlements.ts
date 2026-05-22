import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

export type EntitlementFeature =
  | 'rolePermissions'
  | 'jobCosting'
  | 'customerPortal'
  | 'campaigns'
  | 'advancedAnalytics'
  | 'salesTaxSummary'
  | 'payrollExports'
  | 'forecasting'
  | 'fullApiWebhooks'
  | 'multiLocationControls'
  | 'dedicatedOnboarding'
  | 'plaidReconciliation'
  | 'smsCommunication'
  | 'whiteLabelCustomerPortal';

export type EntitlementLimitKey =
  | 'includedOfficeSeats'
  | 'includedFieldSeats'
  | 'maxActiveCustomers'
  | 'maxAutomationWorkflows'
  | 'includedSmsCreditsMonthly'
  | 'includedEmailCreditsMonthly'
  | 'includedIntegrations'
  | 'maxCampaignSendsMonthly'
  | 'maxConcurrentActiveCampaigns'
  | 'maxCampaignAudienceSize'
  | 'maxCampaignDrafts';

/** Limits stored as plain numbers (excludes nullable field-seat cap). */
export type NumericEntitlementLimitKey = Exclude<EntitlementLimitKey, 'includedFieldSeats'>;

export interface PlanEntitlements {
  plan: PlatformPlanTier;
  displayName: string;
  monthlyPriceUsd: number;
  annualEffectiveMonthlyUsd: number;
  features: Record<EntitlementFeature, boolean>;
  limits: Record<NumericEntitlementLimitKey, number> & {
    /** `null` = unlimited field seats (Pro). */
    includedFieldSeats: number | null;
  };
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
      salesTaxSummary: false,
      payrollExports: false,
      forecasting: false,
      fullApiWebhooks: false,
      multiLocationControls: false,
      dedicatedOnboarding: false,
      plaidReconciliation: false,
      smsCommunication: false,
      whiteLabelCustomerPortal: false,
    },
    limits: {
      includedOfficeSeats: 1,
      includedFieldSeats: 3,
      maxActiveCustomers: 500,
      maxAutomationWorkflows: 3,
      includedSmsCreditsMonthly: 0,
      includedEmailCreditsMonthly: 2500,
      includedIntegrations: 1,
      maxCampaignSendsMonthly: 0,
      maxConcurrentActiveCampaigns: 0,
      maxCampaignAudienceSize: 0,
      maxCampaignDrafts: 0,
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
      salesTaxSummary: true,
      payrollExports: true,
      forecasting: false,
      fullApiWebhooks: false,
      multiLocationControls: false,
      dedicatedOnboarding: false,
      plaidReconciliation: true,
      smsCommunication: false,
      whiteLabelCustomerPortal: false,
    },
    limits: {
      includedOfficeSeats: 2,
      includedFieldSeats: 10,
      maxActiveCustomers: 5000,
      maxAutomationWorkflows: 20,
      includedSmsCreditsMonthly: 0,
      includedEmailCreditsMonthly: 25000,
      includedIntegrations: 5,
      maxCampaignSendsMonthly: 10000,
      maxConcurrentActiveCampaigns: 3,
      maxCampaignAudienceSize: 5000,
      maxCampaignDrafts: 20,
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
      salesTaxSummary: true,
      payrollExports: true,
      forecasting: true,
      fullApiWebhooks: true,
      multiLocationControls: true,
      dedicatedOnboarding: true,
      plaidReconciliation: true,
      smsCommunication: true,
      whiteLabelCustomerPortal: true,
    },
    limits: {
      includedOfficeSeats: 10,
      includedFieldSeats: null,
      maxActiveCustomers: 25000,
      maxAutomationWorkflows: 100,
      includedSmsCreditsMonthly: 25000,
      includedEmailCreditsMonthly: 100000,
      includedIntegrations: 20,
      maxCampaignSendsMonthly: 40000,
      maxConcurrentActiveCampaigns: 10,
      maxCampaignAudienceSize: 15000,
      maxCampaignDrafts: 50,
    },
  },
};

export function getEntitlementsForTier(tier: PlatformPlanTier): PlanEntitlements {
  return PLATFORM_TIER_ENTITLEMENTS[tier];
}

export function isFeatureEnabled(tier: PlatformPlanTier, feature: EntitlementFeature): boolean {
  return PLATFORM_TIER_ENTITLEMENTS[tier].features[feature];
}

export function getTierLimit(tier: PlatformPlanTier, limit: NumericEntitlementLimitKey): number {
  return PLATFORM_TIER_ENTITLEMENTS[tier].limits[limit];
}

export class EntitlementGateError extends Error {
  constructor(
    message: string,
    public readonly code: 'feature_blocked' | 'limit_exceeded',
  ) {
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
  limit: NumericEntitlementLimitKey,
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
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PlatformPlanTier> {
  const { data } = await admin
    .from('tenant_billing_accounts')
    .select('platform_plan')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return parsePlatformPlanTier(String(data?.platform_plan ?? '')) ?? 'starter';
}

export async function resolveTenantEntitlements(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PlanEntitlements> {
  const tier = await resolveTenantPlanTier(admin, tenantId);
  return getEntitlementsForTier(tier);
}
