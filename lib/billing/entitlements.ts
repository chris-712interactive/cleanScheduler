import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePlatformPlanTier, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

/** Paid tier or the fixed DB-only free-trial profile. */
export type EntitlementPlanKey = PlatformPlanTier | 'trial';

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
  | 'whiteLabelCustomerPortal'
  | 'proofOfServicePhotos'
  | 'gpsVerifiedCheckIn'
  | 'invoiceReminderEmail'
  | 'emailVisitReminders'
  | 'publicBookingRequest'
  | 'proofOfServicePortalShare'
  | 'customServiceTypes'
  | 'customerPromotions'
  | 'customerReferralProgram'
  | 'kanbanCustomization'
  | 'tenantMarketingSite'
  | 'tenantMarketingSiteCustomDomain';

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
  | 'maxCampaignDrafts'
  | 'maxMarketingSitePages'
  | 'maxMarketingSiteServiceAreaPages';

/** Limits stored as plain numbers (excludes nullable field-seat cap). */
export type NumericEntitlementLimitKey = Exclude<EntitlementLimitKey, 'includedFieldSeats'>;

export interface PlanEntitlements {
  plan: EntitlementPlanKey;
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
      proofOfServicePhotos: false,
      gpsVerifiedCheckIn: true,
      invoiceReminderEmail: true,
      emailVisitReminders: true,
      publicBookingRequest: true,
      proofOfServicePortalShare: false,
      customServiceTypes: false,
      customerPromotions: false,
      customerReferralProgram: false,
      kanbanCustomization: false,
      tenantMarketingSite: false,
      tenantMarketingSiteCustomDomain: false,
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
      maxMarketingSitePages: 0,
      maxMarketingSiteServiceAreaPages: 0,
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
      proofOfServicePhotos: true,
      gpsVerifiedCheckIn: true,
      invoiceReminderEmail: true,
      emailVisitReminders: true,
      publicBookingRequest: true,
      proofOfServicePortalShare: false,
      customServiceTypes: false,
      customerPromotions: true,
      customerReferralProgram: true,
      kanbanCustomization: false,
      tenantMarketingSite: true,
      tenantMarketingSiteCustomDomain: false,
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
      maxMarketingSitePages: 10,
      maxMarketingSiteServiceAreaPages: 2,
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
      proofOfServicePhotos: true,
      gpsVerifiedCheckIn: true,
      invoiceReminderEmail: true,
      emailVisitReminders: true,
      publicBookingRequest: true,
      proofOfServicePortalShare: true,
      customServiceTypes: true,
      customerPromotions: true,
      customerReferralProgram: true,
      kanbanCustomization: true,
      tenantMarketingSite: true,
      tenantMarketingSiteCustomDomain: true,
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
      maxMarketingSitePages: 50,
      maxMarketingSiteServiceAreaPages: 25,
    },
  },
};

/**
 * Fixed entitlement profile for DB-only free trials (no tier chosen yet).
 * See docs/billing/free-trial-spec.md.
 */
export const TRIAL_ENTITLEMENTS: PlanEntitlements = {
  plan: 'trial',
  displayName: 'Free trial',
  monthlyPriceUsd: 0,
  annualEffectiveMonthlyUsd: 0,
  features: {
    rolePermissions: true,
    jobCosting: true,
    customerPortal: true,
    campaigns: false,
    advancedAnalytics: false,
    salesTaxSummary: true,
    payrollExports: true,
    forecasting: false,
    fullApiWebhooks: false,
    multiLocationControls: false,
    dedicatedOnboarding: false,
    plaidReconciliation: false,
    smsCommunication: false,
    whiteLabelCustomerPortal: false,
    proofOfServicePhotos: true,
    gpsVerifiedCheckIn: true,
    invoiceReminderEmail: true,
    emailVisitReminders: true,
    publicBookingRequest: true,
    proofOfServicePortalShare: false,
    customServiceTypes: false,
    customerPromotions: true,
    customerReferralProgram: true,
    kanbanCustomization: true,
    tenantMarketingSite: true,
    tenantMarketingSiteCustomDomain: false,
  },
  limits: {
    includedOfficeSeats: 2,
    includedFieldSeats: 8,
    maxActiveCustomers: 2000,
    maxAutomationWorkflows: 10,
    includedSmsCreditsMonthly: 0,
    includedEmailCreditsMonthly: 0,
    includedIntegrations: 2,
    maxCampaignSendsMonthly: 0,
    maxConcurrentActiveCampaigns: 0,
    maxCampaignAudienceSize: 0,
    maxCampaignDrafts: 0,
    maxMarketingSitePages: 2,
    maxMarketingSiteServiceAreaPages: 0,
  },
};

export function getEntitlementsForPlan(plan: EntitlementPlanKey): PlanEntitlements {
  if (plan === 'trial') return TRIAL_ENTITLEMENTS;
  return PLATFORM_TIER_ENTITLEMENTS[plan];
}

export function getEntitlementsForTier(tier: PlatformPlanTier): PlanEntitlements {
  return PLATFORM_TIER_ENTITLEMENTS[tier];
}

export function isFeatureEnabled(plan: EntitlementPlanKey, feature: EntitlementFeature): boolean {
  return getEntitlementsForPlan(plan).features[feature];
}

export function getPlanLimit(plan: EntitlementPlanKey, limit: NumericEntitlementLimitKey): number {
  return getEntitlementsForPlan(plan).limits[limit];
}

/** @deprecated Use {@link getPlanLimit} */
export function getTierLimit(tier: PlatformPlanTier, limit: NumericEntitlementLimitKey): number {
  return getPlanLimit(tier, limit);
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

export function assertFeatureEnabled(plan: EntitlementPlanKey, feature: EntitlementFeature): void {
  if (isFeatureEnabled(plan, feature)) return;
  const planName = getEntitlementsForPlan(plan).displayName;
  throw new EntitlementGateError(
    `${planName} does not include this capability. Upgrade your subscription to continue.`,
    'feature_blocked',
  );
}

export function assertLimitNotExceeded(
  plan: EntitlementPlanKey,
  limit: NumericEntitlementLimitKey,
  currentValue: number,
): void {
  const allowed = getPlanLimit(plan, limit);
  if (currentValue < allowed) return;

  const planName = getEntitlementsForPlan(plan).displayName;
  throw new EntitlementGateError(
    `${planName} allows up to ${allowed} for ${limit}. Upgrade or purchase an add-on to continue.`,
    'limit_exceeded',
  );
}

/**
 * Entitlement profile for feature gates and soft limits.
 * All `status=trialing` workspaces use the trial profile regardless of legacy `platform_plan`.
 */
export async function resolveTenantEntitlementPlan(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<EntitlementPlanKey> {
  const { data } = await admin
    .from('tenant_billing_accounts')
    .select('platform_plan, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const status = data?.status ?? 'trialing';
  if (status === 'trialing') {
    return 'trial';
  }

  return parsePlatformPlanTier(String(data?.platform_plan ?? '')) ?? 'starter';
}

/** Paid subscription tier from billing row (`null` during DB-only trial). */
export async function resolveTenantSubscriptionTier(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PlatformPlanTier | null> {
  const { data } = await admin
    .from('tenant_billing_accounts')
    .select('platform_plan')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return parsePlatformPlanTier(String(data?.platform_plan ?? ''));
}

/** @deprecated Use {@link resolveTenantEntitlementPlan} for gates or {@link resolveTenantSubscriptionTier} for billing display. */
export async function resolveTenantPlanTier(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<EntitlementPlanKey> {
  return resolveTenantEntitlementPlan(admin, tenantId);
}

export async function resolveTenantEntitlements(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PlanEntitlements> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  return getEntitlementsForPlan(plan);
}
