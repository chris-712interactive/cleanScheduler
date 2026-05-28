import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  EntitlementGateError,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';

export async function assertWhiteLabelCustomerPortalAllowed(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const [{ data: billing }, tier] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    resolveTenantPlanTier(admin, tenantId),
  ]);

  assertFeatureEnabled(tier, 'whiteLabelCustomerPortal');

  if (!canUsePaidSubscriptionFeatures(billing?.status)) {
    throw new EntitlementGateError(
      'White-label customer portal requires a paid Pro subscription. Subscribe to configure a custom domain.',
      'feature_blocked',
    );
  }
}

export function whiteLabelPortalGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    return error.message;
  }
  return null;
}
