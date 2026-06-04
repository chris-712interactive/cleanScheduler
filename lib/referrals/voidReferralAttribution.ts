import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { clawbackReferralRewardEvents } from '@/lib/referrals/clawbackReferralRewards';

type Admin = SupabaseClient<Database>;

export type VoidReferralAttributionResult =
  | { ok: true; clawbackCents: number }
  | { ok: false; error: string };

export async function voidReferralAttribution(
  admin: Admin,
  input: {
    tenantId: string;
    attributionId: string;
    reason: string;
  },
): Promise<VoidReferralAttributionResult> {
  const { data: row, error } = await admin
    .from('referral_attributions')
    .select('id, status')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.attributionId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Referral attribution not found.' };
  }

  if (row.status === 'voided') {
    return { ok: false, error: 'This attribution is already voided.' };
  }

  let clawbackCents = 0;

  if (row.status === 'qualified') {
    const clawback = await clawbackReferralRewardEvents(admin, {
      tenantId: input.tenantId,
      attributionId: input.attributionId,
      reason: input.reason,
    });
    clawbackCents = clawback.reversedCents;
  }

  const { error: updateError } = await admin
    .from('referral_attributions')
    .update({ status: 'voided' })
    .eq('id', input.attributionId)
    .in('status', ['pending', 'qualified']);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, clawbackCents };
}
