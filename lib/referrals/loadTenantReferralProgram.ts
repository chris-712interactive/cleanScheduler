import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantReferralProgramRow } from '@/lib/referrals/referralTypes';

type Admin = SupabaseClient<Database>;

export type ReferralProgramSnapshot = TenantReferralProgramRow & {
  referrer_promotion_name: string | null;
  referee_promotion_name: string | null;
};

export async function loadTenantReferralProgram(
  admin: Admin,
  tenantId: string,
): Promise<ReferralProgramSnapshot | null> {
  const { data, error } = await admin
    .from('tenant_referral_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const promotionIds = [data.referrer_promotion_id, data.referee_promotion_id].filter(
    (id): id is string => Boolean(id),
  );

  const names = new Map<string, string>();
  if (promotionIds.length > 0) {
    const { data: promotions } = await admin
      .from('tenant_promotions')
      .select('id, name')
      .in('id', promotionIds);
    for (const row of promotions ?? []) {
      names.set(row.id, row.name);
    }
  }

  return {
    ...data,
    referrer_promotion_name: data.referrer_promotion_id
      ? (names.get(data.referrer_promotion_id) ?? null)
      : null,
    referee_promotion_name: data.referee_promotion_id
      ? (names.get(data.referee_promotion_id) ?? null)
      : null,
  };
}

export async function ensureTenantReferralProgramRow(
  admin: Admin,
  tenantId: string,
): Promise<void> {
  const { error } = await admin
    .from('tenant_referral_programs')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function countReferralAttributionsForReferrer(
  admin: Admin,
  tenantId: string,
  referrerCustomerId: string,
): Promise<{ pending: number; qualified: number }> {
  const { data, error } = await admin
    .from('referral_attributions')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('referrer_customer_id', referrerCustomerId);

  if (error) throw new Error(error.message);

  let pending = 0;
  let qualified = 0;
  for (const row of data ?? []) {
    if (row.status === 'qualified') qualified += 1;
    else if (row.status === 'pending') pending += 1;
  }
  return { pending, qualified };
}
