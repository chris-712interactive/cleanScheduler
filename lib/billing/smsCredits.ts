import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EntitlementGateError,
  featureUpgradeMessage,
  getEntitlementsForPlan,
  resolveTenantEntitlementPlan,
  resolveTenantSubscriptionTier,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import {
  allocateSmsSegments,
  applicantUsesSeparateCap,
  isApplicantSmsPurpose,
  isMissingTextPackLedger,
  readTextPackBalance,
  releaseSmsReservation,
  smsAllowanceForMeter,
  TEXT_PACKS_UNAVAILABLE_MESSAGE,
  TEXTING_UNLOCKS_MESSAGE,
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

const PACK_TOO_LOW =
  "This month's allowance is used up and the text pack balance is too low. Buy a text pack to keep texting.";

type ReservePayload = {
  ok?: boolean;
  code?: string;
  from_pack?: number;
  reservation_id?: string;
};

export async function assertCanSendSmsSegments(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  segmentCount: number;
  meter?: SmsMeter;
}): Promise<{ fromPack: number; reservationId: string | null; tier: PlatformPlanTier | null }> {
  const meter = params.meter ?? 'customer';
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

  if (!canUseTexting(billing?.status)) {
    throw new EntitlementGateError(TEXTING_UNLOCKS_MESSAGE, 'feature_blocked');
  }

  const allowance = smsAllowanceForMeter(plan, meter);
  if (!allowance.allowed) {
    throw new EntitlementGateError(
      featureUpgradeMessage(meter === 'customer' ? 'smsCommunication' : 'applicantSms'),
      'feature_blocked',
    );
  }

  const reserved = await params.admin.rpc('reserve_sms_segments', {
    p_tenant: params.tenantId,
    p_segments: params.segmentCount,
    p_meter: meter,
    p_allowance: allowance.allowance,
    p_separate_applicant: allowance.separateApplicantCap,
  });

  if (reserved.error) {
    if (!isMissingTextPackLedger(reserved.error)) {
      throw new Error(reserved.error.message);
    }
    return reserveWithoutLedger({
      admin: params.admin,
      tenantId: params.tenantId,
      segmentCount: params.segmentCount,
      meter,
      plan,
      billingStatus: billing?.status,
      tier: subscriptionTier,
    });
  }

  const payload = reserved.data as ReservePayload | null;
  if (!payload?.ok) {
    throw new EntitlementGateError(
      payload?.code === 'limit_exceeded' ? PACK_TOO_LOW : TEXT_PACKS_UNAVAILABLE_MESSAGE,
      'limit_exceeded',
    );
  }

  return {
    fromPack: payload.from_pack ?? 0,
    reservationId: payload.reservation_id ?? null,
    tier: subscriptionTier,
  };
}

async function reserveWithoutLedger(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  segmentCount: number;
  meter: SmsMeter;
  plan: EntitlementPlanKey;
  billingStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | null | undefined;
  tier: PlatformPlanTier | null;
}): Promise<{ fromPack: number; reservationId: null; tier: PlatformPlanTier | null }> {
  const [generalUsed, applicantUsed, pack] = await Promise.all([
    countSmsSegmentsUsedThisMonth(params.admin, params.tenantId),
    countApplicantSmsSegmentsUsedThisMonth(params.admin, params.tenantId),
    readTextPackBalance(params.admin, params.tenantId),
  ]);
  const allocation = allocateSmsSegments({
    plan: params.plan,
    billingStatus: params.billingStatus,
    meter: params.meter,
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
    throw new EntitlementGateError(TEXT_PACKS_UNAVAILABLE_MESSAGE, 'limit_exceeded');
  }
  return { fromPack: 0, reservationId: null, tier: params.tier };
}

export async function releaseReservedTextPackSegments(params: {
  admin: SupabaseClient<Database>;
  reservationId: string | null;
  refundPack: boolean;
}): Promise<void> {
  await releaseSmsReservation(params.admin, {
    reservationId: params.reservationId,
    refundPack: params.refundPack,
  });
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
