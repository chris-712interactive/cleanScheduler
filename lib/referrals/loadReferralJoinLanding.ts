import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { loadReferralCodeByNormalizedCode } from '@/lib/referrals/customerReferralCode';
import { loadTenantReferralProgram } from '@/lib/referrals/loadTenantReferralProgram';
import { buildReferralShareCopy } from '@/lib/referrals/referralProgramForm';
import { formatPromotionValue } from '@/lib/promotions/promotionTypes';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

export type ReferralJoinLandingView = {
  tenantId: string;
  tenantName: string;
  referralCode: string;
  shareHeadline: string;
  refereeRewardLabel: string | null;
  referrerName: string;
};

function promotionLabel(
  name: string | null,
  type: Database['public']['Enums']['tenant_promotion_type'] | null,
  value: number | null,
): string | null {
  if (!name) return null;
  if (!type || value == null) return name;
  return `${name} (${formatPromotionValue(type, value)})`;
}

export async function loadReferralJoinLanding(
  admin: Admin,
  rawCode: string,
  tenantIdHint?: string | null,
): Promise<ReferralJoinLandingView | null> {
  const codeRow = await loadReferralCodeByNormalizedCode(admin, rawCode, tenantIdHint ?? undefined);
  if (!codeRow?.is_active) return null;

  const tier = await resolveTenantPlanTier(admin, codeRow.tenant_id);
  if (!isFeatureEnabled(tier, 'customerReferralProgram')) return null;

  const program = await loadTenantReferralProgram(admin, codeRow.tenant_id);
  if (!program?.is_enabled) return null;

  const [{ data: tenant }, { data: referrerCustomer }] = await Promise.all([
    admin.from('tenants').select('name').eq('id', codeRow.tenant_id).maybeSingle(),
    admin
      .from('customers')
      .select('customer_identities ( first_name, last_name, full_name, email )')
      .eq('id', codeRow.customer_id)
      .eq('tenant_id', codeRow.tenant_id)
      .maybeSingle(),
  ]);

  const identity = referrerCustomer?.customer_identities as {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    email: string | null;
  } | null;

  let referrerRewardLabel: string | null = program.referrer_promotion_name;
  let refereeRewardLabel: string | null = program.referee_promotion_name;

  if (program.referrer_promotion_id) {
    const { data } = await admin
      .from('tenant_promotions')
      .select('name, promotion_type, promotion_value')
      .eq('id', program.referrer_promotion_id)
      .maybeSingle();
    if (data) {
      referrerRewardLabel = promotionLabel(data.name, data.promotion_type, data.promotion_value);
    }
  }

  if (program.referee_promotion_id) {
    const { data } = await admin
      .from('tenant_promotions')
      .select('name, promotion_type, promotion_value')
      .eq('id', program.referee_promotion_id)
      .maybeSingle();
    if (data) {
      refereeRewardLabel = promotionLabel(data.name, data.promotion_type, data.promotion_value);
    }
  }

  return {
    tenantId: codeRow.tenant_id,
    tenantName: tenant?.name?.trim() || 'Your provider',
    referralCode: codeRow.code,
    shareHeadline: buildReferralShareCopy({
      rewardSideMode: program.reward_side_mode,
      referrerPromotionLabel: referrerRewardLabel,
      refereePromotionLabel: refereeRewardLabel,
      shareHeadline: program.share_headline,
    }),
    refereeRewardLabel,
    referrerName: identity ? formatCustomerDisplayName(identity) : 'A customer',
  };
}

export function buildReferralJoinPath(code: string): string {
  return `/join?ref=${encodeURIComponent(code)}`;
}
