import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertLimitNotExceeded,
  EntitlementGateError,
  getEntitlementsForTier,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

/** Active recurring visit rules count toward maxAutomationWorkflows. */
export async function countActiveAutomationWorkflows(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('recurring_appointment_rules')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function assertCanCreateAutomationWorkflow(params: {
  tier: PlatformPlanTier;
  activeCount: number;
}): void {
  assertLimitNotExceeded(params.tier, 'maxAutomationWorkflows', params.activeCount);
}

export function automationWorkflowGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError && error.code === 'limit_exceeded') {
    const planName = error.message.split(' allows up to ')[0];
    const allowed = error.message.match(/allows up to (\d+)/)?.[1];
    if (planName && allowed) {
      return `${planName} includes up to ${allowed} recurring visit rules. Upgrade your subscription to add more.`;
    }
    return error.message;
  }
  if (error instanceof EntitlementGateError) {
    return error.message;
  }
  return null;
}

export async function assertTenantCanCreateAutomationWorkflow(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const tier = await resolveTenantPlanTier(admin, tenantId);
  const activeCount = await countActiveAutomationWorkflows(admin, tenantId);
  assertCanCreateAutomationWorkflow({ tier, activeCount });
}

export function formatAutomationWorkflowUsage(activeCount: number, tier: PlatformPlanTier): string {
  const limit = getEntitlementsForTier(tier).limits.maxAutomationWorkflows;
  return `${activeCount}/${limit} recurring rules`;
}
