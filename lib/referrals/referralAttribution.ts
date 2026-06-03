import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  ensureCustomerReferralCode,
  loadReferralCodeByNormalizedCode,
} from '@/lib/referrals/customerReferralCode';
import { loadTenantReferralProgram } from '@/lib/referrals/loadTenantReferralProgram';
import { normalizeReferralCode } from '@/lib/referrals/normalizeReferralCode';

type Admin = SupabaseClient<Database>;

export async function recordReferralTouch(
  admin: Admin,
  input: {
    tenantId: string;
    referralCodeId: string;
    landingPath?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
  },
): Promise<string> {
  const { data, error } = await admin
    .from('referral_touches')
    .insert({
      tenant_id: input.tenantId,
      referral_code_id: input.referralCodeId,
      landing_path: input.landingPath ?? null,
      client_ip: input.clientIp?.slice(0, 128) ?? null,
      user_agent: input.userAgent?.slice(0, 2000) ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function attributeRefereeFromReferralCode(
  admin: Admin,
  input: {
    tenantId: string;
    refereeCustomerId: string;
    rawReferralCode: string;
    touchId?: string | null;
  },
): Promise<{ ok: true; attributionId: string } | { ok: false; error: string; skipped?: boolean }> {
  const program = await loadTenantReferralProgram(admin, input.tenantId);
  if (!program?.is_enabled) {
    return { ok: false, error: 'Referral program is not enabled.', skipped: true };
  }

  const codeRow = await loadReferralCodeByNormalizedCode(
    admin,
    input.rawReferralCode,
    input.tenantId,
  );
  if (!codeRow?.is_active) {
    return { ok: false, error: 'Referral code not found.', skipped: true };
  }

  if (codeRow.customer_id === input.refereeCustomerId) {
    return { ok: false, error: 'Self-referrals are not allowed.', skipped: true };
  }

  const { data: existing } = await admin
    .from('referral_attributions')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('referee_customer_id', input.refereeCustomerId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'This customer already has a referral attribution.', skipped: true };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + program.click_window_days);

  const { data, error } = await admin
    .from('referral_attributions')
    .insert({
      tenant_id: input.tenantId,
      referral_code_id: codeRow.id,
      referrer_customer_id: codeRow.customer_id,
      referee_customer_id: input.refereeCustomerId,
      touch_id: input.touchId ?? null,
      attribution_source: 'link',
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('referral_attributions_tenant_id_referee_customer_id_key')) {
      return { ok: false, error: 'Referral already attributed.', skipped: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, attributionId: data.id };
}

export async function attributeRefereeByReferrerCustomer(
  admin: Admin,
  input: {
    tenantId: string;
    refereeCustomerId: string;
    referrerCustomerId: string;
    referrerDisplayName?: string | null;
  },
): Promise<{ ok: true; attributionId: string } | { ok: false; error: string }> {
  const program = await loadTenantReferralProgram(admin, input.tenantId);
  if (!program?.is_enabled) {
    return { ok: false, error: 'Referral program is not enabled.' };
  }

  if (input.referrerCustomerId === input.refereeCustomerId) {
    return { ok: false, error: 'Self-referrals are not allowed.' };
  }

  const { data: referrer } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.referrerCustomerId)
    .maybeSingle();

  if (!referrer) {
    return { ok: false, error: 'Referrer customer not found in this workspace.' };
  }

  const { data: referee } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.refereeCustomerId)
    .maybeSingle();

  if (!referee) {
    return { ok: false, error: 'Customer not found in this workspace.' };
  }

  const { data: existing } = await admin
    .from('referral_attributions')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('referee_customer_id', input.refereeCustomerId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'This customer already has a referral attribution.' };
  }

  const codeRow = await ensureCustomerReferralCode(admin, {
    tenantId: input.tenantId,
    customerId: input.referrerCustomerId,
    displayName: input.referrerDisplayName,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + program.click_window_days);

  const { data, error } = await admin
    .from('referral_attributions')
    .insert({
      tenant_id: input.tenantId,
      referral_code_id: codeRow.id,
      referrer_customer_id: input.referrerCustomerId,
      referee_customer_id: input.refereeCustomerId,
      touch_id: null,
      attribution_source: 'manual',
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.includes('referral_attributions_tenant_id_referee_customer_id_key')) {
      return { ok: false, error: 'Referral already attributed.' };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, attributionId: data.id };
}

export async function captureReferralFromCodeString(
  admin: Admin,
  input: {
    rawCode: string;
    tenantId?: string;
    landingPath?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
  },
): Promise<{ touchId: string; code: string; tenantId: string } | null> {
  const normalized = normalizeReferralCode(input.rawCode);
  if (normalized.length < 4) return null;

  const codeRow = await loadReferralCodeByNormalizedCode(admin, normalized, input.tenantId);
  if (!codeRow?.is_active) return null;

  const program = await loadTenantReferralProgram(admin, codeRow.tenant_id);
  if (!program?.is_enabled) return null;

  const touchId = await recordReferralTouch(admin, {
    tenantId: codeRow.tenant_id,
    referralCodeId: codeRow.id,
    landingPath: input.landingPath,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
  });

  return { touchId, code: codeRow.code, tenantId: codeRow.tenant_id };
}
