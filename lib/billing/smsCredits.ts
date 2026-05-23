import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  EntitlementGateError,
  getEntitlementsForPlan,
  resolveTenantEntitlementPlan,
  resolveTenantSubscriptionTier,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import { canUseSmsCommunication } from '@/lib/billing/tenantSubscriptionAccess';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function countSmsSegmentsUsedThisMonth(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('tenant_sms_messages')
    .select('segment_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .gte('created_at', monthStartIso());

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + (row.segment_count ?? 0), 0);
}

export function assertSmsFeatureEnabled(plan: EntitlementPlanKey): void {
  assertFeatureEnabled(plan, 'smsCommunication');
}

export async function assertCanSendSmsSegments(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  segmentCount: number;
}): Promise<PlatformPlanTier> {
  if (params.segmentCount < 1) {
    throw new EntitlementGateError('SMS body is empty.', 'limit_exceeded');
  }

  const [{ data: billing }, plan, subscriptionTier] = await Promise.all([
    params.admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', params.tenantId)
      .maybeSingle(),
    resolveTenantEntitlementPlan(params.admin, params.tenantId),
    resolveTenantSubscriptionTier(params.admin, params.tenantId),
  ]);

  assertSmsFeatureEnabled(plan);

  if (!canUseSmsCommunication(billing?.status)) {
    throw new EntitlementGateError(
      'SMS is available on a paid Pro subscription. Subscribe to unlock quote and visit reminder texts.',
      'feature_blocked',
    );
  }

  const tier = subscriptionTier ?? 'pro';
  const used = await countSmsSegmentsUsedThisMonth(params.admin, params.tenantId);
  assertLimitNotExceeded(tier, 'includedSmsCreditsMonthly', used + params.segmentCount - 1);

  return tier;
}

export async function resolveTenantSmsCommunicationAllowed(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<boolean> {
  const [{ data: billing }, plan] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    resolveTenantEntitlementPlan(admin, tenantId),
  ]);

  try {
    assertSmsFeatureEnabled(plan);
  } catch {
    return false;
  }

  return canUseSmsCommunication(billing?.status);
}

export function formatSmsUsageSummary(used: number, tier: PlatformPlanTier): string {
  const limit = getEntitlementsForPlan(tier).limits.includedSmsCreditsMonthly;
  return `${used.toLocaleString()}/${limit.toLocaleString()} SMS segments this month`;
}

export function smsGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    if (error.code === 'feature_blocked') {
      return error.message;
    }
    return error.message.replace(
      ' for includedSmsCreditsMonthly. Upgrade or purchase an add-on to continue.',
      ' SMS segments this month. Upgrade your subscription to send more.',
    );
  }
  return null;
}
