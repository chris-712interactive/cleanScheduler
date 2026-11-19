import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import {
  EntitlementGateError,
  featureUpgradeMessage,
  getEntitlementsForPlan,
  isFeatureEnabled,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import { canUseTexting, type TenantBillingStatus } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';

export const TEXTING_UNLOCKS_MESSAGE = 'Texting unlocks once your subscription starts.';
export const TEXT_PACKS_UNAVAILABLE_MESSAGE = 'Text packs are not available yet.';
export const TEXT_PACK_BUYERS = 'Only an owner or admin can buy a text pack.';
export const TEXT_PACK_PLAN_MESSAGE = 'Text packs are available on the Business and Pro plans.';

export const BUSINESS_APPLICANT_SMS_MONTHLY = 100;

export const TEXT_PACKS = {
  pack_1000: {
    key: 'pack_1000',
    segments: 1000,
    amountCents: 1500,
    priceLabel: '$15',
    segmentLabel: '1,000',
  },
  pack_2500: {
    key: 'pack_2500',
    segments: 2500,
    amountCents: 3500,
    priceLabel: '$35',
    segmentLabel: '2,500',
  },
} as const;

export type TextPackKey = keyof typeof TEXT_PACKS;

export type SmsMeter = 'customer' | 'applicant';

const APPLICANT_PURPOSE_PREFIX = 'hiring_';

export function isApplicantSmsPurpose(purpose: string): boolean {
  return purpose.startsWith(APPLICANT_PURPOSE_PREFIX);
}

export function parseTextPackKey(value: string | null | undefined): TextPackKey | null {
  if (value === 'pack_1000' || value === 'pack_2500') return value;
  return null;
}

/** One-time Stripe Price IDs. Unset means the buy buttons stay hidden. */
export function textPackPriceId(pack: TextPackKey): string | null {
  const raw =
    pack === 'pack_1000'
      ? process.env.STRIPE_PRICE_TEXT_PACK_1000
      : process.env.STRIPE_PRICE_TEXT_PACK_2500;
  const id = raw?.trim() ?? '';
  return id.length > 0 ? id : null;
}

export function textPackPricesConfigured(): boolean {
  return textPackPriceId('pack_1000') != null && textPackPriceId('pack_2500') != null;
}

export function applicantUsesSeparateCap(plan: EntitlementPlanKey): boolean {
  return isFeatureEnabled(plan, 'applicantSms') && !isFeatureEnabled(plan, 'smsCommunication');
}

export function smsAllowanceForMeter(
  plan: EntitlementPlanKey,
  meter: SmsMeter,
): { allowed: boolean; allowance: number; separateApplicantCap: boolean } {
  const entitlements = getEntitlementsForPlan(plan);
  if (meter === 'customer') {
    return {
      allowed: entitlements.features.smsCommunication,
      allowance: entitlements.limits.includedSmsCreditsMonthly,
      separateApplicantCap: false,
    };
  }

  if (entitlements.features.smsCommunication) {
    return {
      allowed: true,
      allowance: entitlements.limits.includedSmsCreditsMonthly,
      separateApplicantCap: false,
    };
  }

  if (entitlements.features.applicantSms) {
    return {
      allowed: true,
      allowance: entitlements.limits.includedApplicantSmsCreditsMonthly,
      separateApplicantCap: true,
    };
  }

  return { allowed: false, allowance: 0, separateApplicantCap: false };
}

export type SmsAllocation =
  | { ok: true; fromAllowance: number; fromPack: number }
  | { ok: false; code: 'feature_blocked' | 'limit_exceeded'; message: string };

/**
 * Plan allowance is spent first. Pack segments cover only the remainder.
 * A missing ledger cannot cover overflow; the monthly allowance still applies.
 */
export function allocateSmsSegments(input: {
  plan: EntitlementPlanKey;
  billingStatus: TenantBillingStatus | null | undefined;
  meter: SmsMeter;
  segmentCount: number;
  generalUsed: number;
  applicantUsed: number;
  packRemaining: number;
  packsAvailable: boolean;
}): SmsAllocation {
  if (input.segmentCount < 1) {
    return { ok: false, code: 'limit_exceeded', message: 'SMS body is empty.' };
  }

  if (!canUseTexting(input.billingStatus)) {
    return { ok: false, code: 'feature_blocked', message: TEXTING_UNLOCKS_MESSAGE };
  }

  const meter = smsAllowanceForMeter(input.plan, input.meter);
  if (!meter.allowed) {
    const feature = input.meter === 'customer' ? 'smsCommunication' : 'applicantSms';
    return {
      ok: false,
      code: 'feature_blocked',
      message: featureUpgradeMessage(feature),
    };
  }

  const used = meter.separateApplicantCap ? input.applicantUsed : input.generalUsed;
  const allowanceLeft = Math.max(0, meter.allowance - used);
  const fromAllowance = Math.min(input.segmentCount, allowanceLeft);
  const fromPack = input.segmentCount - fromAllowance;

  if (fromPack === 0) {
    return { ok: true, fromAllowance, fromPack };
  }

  if (!input.packsAvailable) {
    return { ok: false, code: 'limit_exceeded', message: TEXT_PACKS_UNAVAILABLE_MESSAGE };
  }

  if (input.packRemaining < fromPack) {
    return {
      ok: false,
      code: 'limit_exceeded',
      message:
        "This month's allowance is used up and the text pack balance is too low. Buy a text pack to keep texting.",
    };
  }

  return { ok: true, fromAllowance, fromPack };
}

export type AllowanceWarning = {
  level: 'warn' | 'limit';
  message: string;
};

/** Warn at 80% of the monthly allowance and again when it is used up. */
export function allowanceWarning(
  used: number,
  allowance: number,
  label: string,
): AllowanceWarning | null {
  if (allowance <= 0 || used <= 0) return null;
  if (used >= allowance) {
    return {
      level: 'limit',
      message: `${label} limit reached (${used.toLocaleString()}/${allowance.toLocaleString()}). Buy a text pack to keep texting.`,
    };
  }
  const ratio = used / allowance;
  if (ratio >= 0.8) {
    const pct = Math.round(ratio * 100);
    return {
      level: 'warn',
      message: `${label} at ${pct}% (${used.toLocaleString()}/${allowance.toLocaleString()}). Buy a text pack before this allowance runs out.`,
    };
  }
  return null;
}

export function textPackPurchaseDenial(input: {
  role: TenantRole;
  plan: EntitlementPlanKey;
  billingStatus: TenantBillingStatus | null | undefined;
  pricesConfigured: boolean;
  ledgerAvailable: boolean;
}): string | null {
  if (!canUseTexting(input.billingStatus)) return TEXTING_UNLOCKS_MESSAGE;
  if (input.role !== 'owner' && input.role !== 'admin') return TEXT_PACK_BUYERS;
  if (input.plan !== 'business' && input.plan !== 'pro') return TEXT_PACK_PLAN_MESSAGE;
  if (!input.pricesConfigured || !input.ledgerAvailable) return TEXT_PACKS_UNAVAILABLE_MESSAGE;
  return null;
}

type QueryError = { code?: string | null; message?: string | null };

export function isMissingTextPackLedger(error: QueryError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') {
    return true;
  }
  const message = error.message?.toLowerCase() ?? '';
  const namesLedger =
    message.includes('tenant_text_pack_ledger') ||
    message.includes('tenant_sms_reservations') ||
    message.includes('consume_text_pack_segments') ||
    message.includes('refund_text_pack_segments') ||
    message.includes('reserve_sms_segments') ||
    message.includes('release_sms_reservation');
  return (
    namesLedger &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
}

export async function readTextPackBalance(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ available: boolean; remaining: number }> {
  const { data, error } = await admin
    .from('tenant_text_pack_ledger')
    .select('segments')
    .eq('tenant_id', tenantId);

  if (error) {
    if (isMissingTextPackLedger(error)) return { available: false, remaining: 0 };
    throw new Error(error.message);
  }

  const remaining = (data ?? []).reduce((sum, row) => sum + (row.segments ?? 0), 0);
  return { available: true, remaining };
}

export async function consumeTextPackSegments(
  admin: SupabaseClient<Database>,
  tenantId: string,
  segments: number,
): Promise<boolean> {
  if (segments <= 0) return true;
  const { data, error } = await admin.rpc('consume_text_pack_segments', {
    p_tenant: tenantId,
    p_segments: segments,
  });
  if (error) {
    if (isMissingTextPackLedger(error)) {
      throw new EntitlementGateError(TEXT_PACKS_UNAVAILABLE_MESSAGE, 'limit_exceeded');
    }
    throw new Error(error.message);
  }
  return data === true;
}

export async function releaseSmsReservation(
  admin: SupabaseClient<Database>,
  params: { reservationId: string | null; refundPack: boolean },
): Promise<void> {
  if (!params.reservationId) return;
  const { error } = await admin.rpc('release_sms_reservation', {
    p_reservation: params.reservationId,
    p_refund_pack: params.refundPack,
  });
  if (error && !isMissingTextPackLedger(error)) {
    console.error('[text-packs] release failed:', error.message);
  }
}

export async function refundTextPackSegments(
  admin: SupabaseClient<Database>,
  tenantId: string,
  segments: number,
): Promise<void> {
  if (segments <= 0) return;
  const { error } = await admin.rpc('refund_text_pack_segments', {
    p_tenant: tenantId,
    p_segments: segments,
  });
  if (error && !isMissingTextPackLedger(error)) {
    console.error('[text-packs] refund failed:', error.message);
  }
}

export type TextPackCredit =
  | { action: 'ignore' }
  | {
      action: 'credit';
      tenantId: string;
      packKey: TextPackKey;
      segments: number;
      amountCents: number;
      sessionId: string;
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseTextPackCredit(input: {
  sessionId: string | null | undefined;
  mode: string | null | undefined;
  paymentStatus: string | null | undefined;
  amountTotal: number | null | undefined;
  currency: string | null | undefined;
  metadata: { kind?: string | null; tenant_id?: string | null; pack_key?: string | null } | null;
}): TextPackCredit {
  if (input.metadata?.kind !== 'text_pack') return { action: 'ignore' };
  if (input.mode !== 'payment') return { action: 'ignore' };
  if (input.paymentStatus !== 'paid') return { action: 'ignore' };

  const sessionId = input.sessionId?.trim() ?? '';
  const tenantId = input.metadata.tenant_id?.trim() ?? '';
  const packKey = parseTextPackKey(input.metadata.pack_key);
  if (!sessionId || !UUID_RE.test(tenantId) || !packKey) return { action: 'ignore' };

  const pack = TEXT_PACKS[packKey];
  const currency = input.currency?.trim().toLowerCase() ?? '';
  if (currency && currency !== 'usd') return { action: 'ignore' };
  if (input.amountTotal !== pack.amountCents) return { action: 'ignore' };

  return {
    action: 'credit',
    tenantId,
    packKey,
    segments: pack.segments,
    amountCents: pack.amountCents,
    sessionId,
  };
}

export async function creditTextPackPurchase(
  admin: SupabaseClient<Database>,
  credit: Extract<TextPackCredit, { action: 'credit' }>,
): Promise<'credited' | 'duplicate'> {
  const { error } = await admin.from('tenant_text_pack_ledger').insert({
    tenant_id: credit.tenantId,
    segments: credit.segments,
    kind: 'purchase',
    stripe_checkout_session_id: credit.sessionId,
    pack_key: credit.packKey,
    amount_cents: credit.amountCents,
  });

  if (!error) return 'credited';
  if (error.code === '23505') return 'duplicate';
  throw new Error(error.message);
}
