import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  EntitlementGateError,
  getEntitlementsForTier,
  isFeatureEnabled,
  resolveTenantPlanTier,
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
  const tier = await resolveTenantPlanTier(admin, tenantId);
  return isFeatureEnabled(tier, feature);
}

export function assertFeatureEnabledForTier(tier: PlatformPlanTier, feature: EntitlementFeature): void {
  assertFeatureEnabled(tier, feature);
}

export async function assertTenantFeatureEnabled(
  admin: SupabaseClient<Database>,
  tenantId: string,
  feature: EntitlementFeature,
): Promise<void> {
  const tier = await resolveTenantPlanTier(admin, tenantId);
  assertFeatureEnabled(tier, feature);
}

export function featureGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    return error.message;
  }
  return null;
}
