import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { CustomerTenantLink } from '@/lib/customer/customerContext';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { ensureCustomerReferralCode } from '@/lib/referrals/customerReferralCode';
import {
  countReferralAttributionsForReferrer,
  loadTenantReferralProgram,
} from '@/lib/referrals/loadTenantReferralProgram';
import { buildReferralShareCopy } from '@/lib/referrals/referralProgramForm';
import { formatPromotionValue } from '@/lib/promotions/promotionTypes';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';

type Admin = SupabaseClient<Database>;

export type CustomerReferralPortalView = {
  tenantId: string;
  tenantName: string;
  programEnabled: boolean;
  shareHeadline: string;
  termsText: string | null;
  referralCode: string;
  shareUrl: string;
  stats: { pending: number; qualified: number };
  rewardSideMode: Database['public']['Enums']['tenant_referral_reward_side_mode'];
  referrerRewardLabel: string | null;
  refereeRewardLabel: string | null;
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

export async function loadCustomerReferralPortalView(
  admin: Admin,
  input: {
    link: CustomerTenantLink;
    displayName?: string | null;
  },
): Promise<CustomerReferralPortalView | null> {
  const tier = await resolveTenantPlanTier(admin, input.link.tenantId);
  if (!isFeatureEnabled(tier, 'customerReferralProgram')) return null;

  const program = await loadTenantReferralProgram(admin, input.link.tenantId);
  if (!program?.is_enabled) return null;

  const { code } = await ensureCustomerReferralCode(admin, {
    tenantId: input.link.tenantId,
    customerId: input.link.customerId,
    displayName: input.displayName,
  });

  const shareUrl = await customerPortalUrlForTenant(
    admin,
    input.link.tenantId,
    `/?ref=${encodeURIComponent(code)}`,
  );

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

  const stats = await countReferralAttributionsForReferrer(
    admin,
    input.link.tenantId,
    input.link.customerId,
  );

  return {
    tenantId: input.link.tenantId,
    tenantName: input.link.tenantName,
    programEnabled: true,
    shareHeadline: buildReferralShareCopy({
      rewardSideMode: program.reward_side_mode,
      referrerPromotionLabel: referrerRewardLabel,
      refereePromotionLabel: refereeRewardLabel,
      shareHeadline: program.share_headline,
    }),
    termsText: program.terms_text,
    referralCode: code,
    shareUrl,
    stats,
    rewardSideMode: program.reward_side_mode,
    referrerRewardLabel,
    refereeRewardLabel,
  };
}

export async function customerReferralsNavEnabled(
  admin: Admin,
  link: CustomerTenantLink,
): Promise<boolean> {
  const tier = await resolveTenantPlanTier(admin, link.tenantId);
  if (!isFeatureEnabled(tier, 'customerReferralProgram')) return false;
  const program = await loadTenantReferralProgram(admin, link.tenantId);
  return program?.is_enabled === true;
}
