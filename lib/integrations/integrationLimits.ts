import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  EntitlementGateError,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';

export async function assertTenantIntegrationsAllowed(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const [{ data: billing }, tier] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    resolveTenantPlanTier(admin, tenantId),
  ]);

  assertFeatureEnabled(tier, 'fullApiWebhooks');

  if (!canUsePaidSubscriptionFeatures(billing?.status)) {
    throw new EntitlementGateError(
      'API and webhooks require a paid Pro subscription. Subscribe to manage integrations.',
      'feature_blocked',
    );
  }
}

export async function countActiveIntegrations(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const [keys, endpoints] = await Promise.all([
    admin
      .from('tenant_api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('revoked_at', null),
    admin
      .from('tenant_webhook_endpoints')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('enabled', true),
  ]);

  return (keys.count ?? 0) + (endpoints.count ?? 0);
}

export async function assertCanAddIntegration(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  await assertTenantIntegrationsAllowed(admin, tenantId);
  const tier = await resolveTenantPlanTier(admin, tenantId);
  const used = await countActiveIntegrations(admin, tenantId);
  assertLimitNotExceeded(tier, 'includedIntegrations', used);
}

export function integrationGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    return error.message;
  }
  return null;
}
