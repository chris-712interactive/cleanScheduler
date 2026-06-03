import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  generateReferralCodeSuffix,
  normalizeReferralCode,
} from '@/lib/referrals/normalizeReferralCode';

type Admin = SupabaseClient<Database>;

function codePrefixFromName(name: string | null | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  return cleaned.length >= 2 ? cleaned : 'FRIEND';
}

export async function ensureCustomerReferralCode(
  admin: Admin,
  input: { tenantId: string; customerId: string; displayName?: string | null },
): Promise<{ code: string; id: string }> {
  const { data: existing } = await admin
    .from('customer_referral_codes')
    .select('id, code')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .maybeSingle();

  if (existing) {
    return { code: existing.code, id: existing.id };
  }

  const prefix = codePrefixFromName(input.displayName);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = normalizeReferralCode(`${prefix}${generateReferralCodeSuffix()}`);
    const { data, error } = await admin
      .from('customer_referral_codes')
      .insert({
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        code,
      })
      .select('id, code')
      .single();

    if (!error && data) {
      return { code: data.code, id: data.id };
    }
    if (!error?.message.includes('customer_referral_codes_tenant_code_uidx')) {
      throw new Error(error?.message ?? 'Could not create referral code.');
    }
  }

  throw new Error('Could not generate a unique referral code.');
}

export async function loadReferralCodeByNormalizedCode(
  admin: Admin,
  rawCode: string,
  tenantId?: string,
): Promise<{
  id: string;
  tenant_id: string;
  customer_id: string;
  code: string;
  is_active: boolean;
} | null> {
  const code = normalizeReferralCode(rawCode);
  if (code.length < 4) return null;

  let q = admin
    .from('customer_referral_codes')
    .select('id, tenant_id, customer_id, code, is_active')
    .eq('code', code);

  if (tenantId) {
    q = q.eq('tenant_id', tenantId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
