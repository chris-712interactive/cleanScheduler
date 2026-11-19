import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntitlementPlanKey } from '@/lib/billing/entitlements';
import {
  assertFeatureEnabled,
  EntitlementGateError,
  getEntitlementsForTier,
  isFeatureEnabled,
  minimumPaidTierForFeature,
  resolveTenantEntitlementPlan,
  type EntitlementFeature,
} from '@/lib/billing/entitlements';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

export function minimumTierForFeature(feature: EntitlementFeature): PlatformPlanTier {
  return minimumPaidTierForFeature(feature);
}

export function minimumTierLabelForFeature(feature: EntitlementFeature): string {
  return getEntitlementsForTier(minimumPaidTierForFeature(feature)).displayName;
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
