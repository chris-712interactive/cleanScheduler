import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntitlementPlanKey } from '@/lib/billing/entitlements';
import {
  assertFeatureEnabled,
  EntitlementGateError,
  getEntitlementsForTier,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
  type EntitlementFeature,
} from '@/lib/billing/entitlements';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

const FEATURE_MINIMUM_TIER: Record<EntitlementFeature, PlatformPlanTier> = {
  rolePermissions: 'business',
  jobCosting: 'business',
  customerPortal: 'business',
  campaigns: 'business',
  advancedAnalytics: 'pro',
  salesTaxSummary: 'business',
  payrollExports: 'business',
  forecasting: 'pro',
  fullApiWebhooks: 'pro',
  multiLocationControls: 'pro',
  dedicatedOnboarding: 'pro',
  plaidReconciliation: 'business',
  smsCommunication: 'pro',
  whiteLabelCustomerPortal: 'pro',
  proofOfServicePhotos: 'starter',
  gpsVerifiedCheckIn: 'starter',
  invoiceReminderEmail: 'starter',
  emailVisitReminders: 'starter',
  emailOnMyWay: 'starter',
  emailReviewRequest: 'starter',
  publicBookingRequest: 'starter',
  visitChecklists: 'starter',
  proofOfServicePortalShare: 'pro',
  customServiceTypes: 'pro',
  customerPromotions: 'business',
  customerReferralProgram: 'business',
  kanbanCustomization: 'pro',
  tenantMarketingSite: 'business',
  tenantMarketingSiteCustomDomain: 'pro',
};

export function minimumTierForFeature(feature: EntitlementFeature): PlatformPlanTier {
  return FEATURE_MINIMUM_TIER[feature];
}

export function minimumTierLabelForFeature(feature: EntitlementFeature): string {
  return getEntitlementsForTier(FEATURE_MINIMUM_TIER[feature]).displayName;
}

export async function resolveTenantFeatureEnabled(
  admin: SupabaseClient<Database>,
  tenantId: string,
  feature: EntitlementFeature,
): Promise<boolean> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  return isFeatureEnabled(plan, feature);
}

export function assertFeatureEnabledForPlan(
  plan: EntitlementPlanKey,
  feature: EntitlementFeature,
): void {
  assertFeatureEnabled(plan, feature);
}

/** @deprecated Use {@link assertFeatureEnabledForPlan} */
export function assertFeatureEnabledForTier(
  plan: EntitlementPlanKey,
  feature: EntitlementFeature,
): void {
  assertFeatureEnabled(plan, feature);
}

export async function assertTenantFeatureEnabled(
  admin: SupabaseClient<Database>,
  tenantId: string,
  feature: EntitlementFeature,
): Promise<void> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  assertFeatureEnabled(plan, feature);
}

export function featureGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    return error.message;
  }
  return null;
}
