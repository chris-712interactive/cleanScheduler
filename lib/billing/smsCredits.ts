import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EntitlementGateError,
  getEntitlementsForPlan,
  resolveTenantEntitlementPlan,
  resolveTenantSubscriptionTier,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import {
  allocateSmsSegments,
  applicantUsesSeparateCap,
  consumeTextPackSegments,
  isApplicantSmsPurpose,
  readTextPackBalance,
  refundTextPackSegments,
  smsAllowanceForMeter,
  type SmsMeter,
} from '@/lib/billing/textPacks';
import { canUseTexting } from '@/lib/billing/tenantSubscriptionAccess';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function listSentSegmentsThisMonth(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ purpose: string; segment_count: number | null }[]> {
  const { data, error } = await admin
    .from('tenant_sms_messages')
    .select('purpose, segment_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .gte('created_at', monthStartIso());

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function countSmsSegmentsUsedThisMonth(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const rows = await listSentSegmentsThisMonth(admin, tenantId);
  return rows.reduce((sum, row) => sum + (row.segment_count ?? 0), 0);
}

export async function countApplicantSmsSegmentsUsedThisMonth(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const rows = await listSentSegmentsThisMonth(admin, tenantId);
  return rows.reduce((sum, row) => {
    if (!isApplicantSmsPurpose(row.purpose)) return sum;
    return sum + (row.segment_count ?? 0);
  }, 0);
}

export function assertSmsFeatureEnabled(plan: EntitlementPlanKey): void {
  const allowance = smsAllowanceForMeter(plan, 'customer');
  if (allowance.allowed) return;
  const allocation = allocateSmsSegments({
    plan,
    billingStatus: 'active',
    meter: 'customer',
    segmentCount: 1,
    generalUsed: 0,
    applicantUsed: 0,
    packRemaining: 0,
    packsAvailable: false,
  });
  if (!allocation.ok) {
    throw new EntitlementGateError(allocation.message, allocation.code);
  }
}

export async function assertCanSendSmsSegments(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  segmentCount: number;
  meter?: SmsMeter;
}): Promise<{ fromPack: number; tier: PlatformPlanTier | null }> {
  const meter = params.meter ?? 'customer';
  const [{ data: billing }, plan, subscriptionTier, generalUsed, applicantUsed, pack] =
    await Promise.all([
      params.admin
        .from('tenant_billing_accounts')
        .select('status')
        .eq('tenant_id', params.tenantId)
        .maybeSingle(),
      resolveTenantEntitlementPlan(params.admin, params.tenantId),
      resolveTenantSubscriptionTier(params.admin, params.tenantId),
      countSmsSegmentsUsedThisMonth(params.admin, params.tenantId),
      countApplicantSmsSegmentsUsedThisMonth(params.admin, params.tenantId),
      readTextPackBalance(params.admin, params.tenantId),
    ]);

  const allocation = allocateSmsSegments({
    plan,
    billingStatus: billing?.status,
    meter,
    segmentCount: params.segmentCount,
    generalUsed,
    applicantUsed,
    packRemaining: pack.remaining,
    packsAvailable: pack.available,
  });

  if (!allocation.ok) {
    throw new EntitlementGateError(allocation.message, allocation.code);
  }

  if (allocation.fromPack > 0) {
    const consumed = await consumeTextPackSegments(
      params.admin,
      params.tenantId,
      allocation.fromPack,
    );
    if (!consumed) {
      throw new EntitlementGateError(
        "This month's allowance is used up and the text pack balance is too low. Buy a text pack to keep texting.",
        'limit_exceeded',
      );
    }
  }

  return { fromPack: allocation.fromPack, tier: subscriptionTier };
}

export async function releaseReservedTextPackSegments(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  segments: number;
}): Promise<void> {
  await refundTextPackSegments(params.admin, params.tenantId, params.segments);
}

export async function resolveTenantSmsCommunicationAllowed(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<boolean> {
  const [{ data: billing }, plan] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    resolveTenantEntitlementPlan(admin, tenantId),
  ]);

  if (!canUseTexting(billing?.status)) return false;
  return smsAllowanceForMeter(plan, 'customer').allowed;
}

export async function resolveTenantApplicantSmsAllowed(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<boolean> {
  const [{ data: billing }, plan] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    resolveTenantEntitlementPlan(admin, tenantId),
  ]);

  if (!canUseTexting(billing?.status)) return false;
  return smsAllowanceForMeter(plan, 'applicant').allowed;
}

export function formatSmsUsageSummary(used: number, tier: PlatformPlanTier): string {
  const limit = getEntitlementsForPlan(tier).limits.includedSmsCreditsMonthly;
  return `${used.toLocaleString()}/${limit.toLocaleString()} SMS segments this month`;
}

export function formatApplicantSmsUsageSummary(used: number, plan: EntitlementPlanKey): string {
  if (applicantUsesSeparateCap(plan)) {
    const limit = getEntitlementsForPlan(plan).limits.includedApplicantSmsCreditsMonthly;
    return `${used.toLocaleString()}/${limit.toLocaleString()} applicant SMS segments this month`;
  }
  const limit = getEntitlementsForPlan(plan).limits.includedSmsCreditsMonthly;
  return `${used.toLocaleString()}/${limit.toLocaleString()} SMS segments this month, including applicant texts`;
}

export function smsGateErrorMessage(error: unknown): string | null {
  if (error instanceof EntitlementGateError) {
    if (error.code === 'feature_blocked') {
      return error.message;
    }
    return error.message.replace(
      ' for SMS segments. Upgrade your plan to continue.',
      ' SMS segments this month. Upgrade your plan to send more.',
    );
  }
  return null;
}
