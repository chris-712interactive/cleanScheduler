import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { grantCustomerWalletCredit } from '@/lib/promotions/customerWallet';
import type { ReferralRewardRecipient } from '@/lib/referrals/referralTypes';
import { referralPromotionWalletAmountCents } from '@/lib/referrals/referralQualificationRules';

type Admin = SupabaseClient<Database>;

export type IssueReferralRewardResult =
  | { ok: true; amountCents: number; skipped?: false }
  | { ok: false; error: string; skipped?: boolean };

function walletAmountFromPromotion(promotion: {
  promotion_type: Database['public']['Enums']['tenant_promotion_type'];
  promotion_value: number;
}): number | null {
  return referralPromotionWalletAmountCents(promotion);
}

export async function issueReferralPromotionReward(
  admin: Admin,
  input: {
    tenantId: string;
    attributionId: string;
    customerId: string;
    promotionId: string;
    recipient: ReferralRewardRecipient;
  },
): Promise<IssueReferralRewardResult> {
  const { data: existingEvent } = await admin
    .from('referral_reward_events')
    .select('id')
    .eq('attribution_id', input.attributionId)
    .eq('recipient', input.recipient)
    .maybeSingle();

  if (existingEvent) {
    return { ok: false, error: 'Reward already issued.', skipped: true };
  }

  const { data: promotion, error: promotionError } = await admin
    .from('tenant_promotions')
    .select('id, name, promotion_type, promotion_value, is_active')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.promotionId)
    .maybeSingle();

  if (promotionError) return { ok: false, error: promotionError.message };
  if (!promotion?.is_active) {
    return { ok: false, error: 'Linked promotion is inactive.', skipped: true };
  }

  const amountCents = walletAmountFromPromotion(promotion);
  if (amountCents == null || amountCents <= 0) {
    return {
      ok: false,
      error: 'Only account credit and fixed-amount promotions can be issued as referral rewards.',
      skipped: true,
    };
  }

  const { data: redemption, error: redemptionError } = await admin
    .from('tenant_promotion_redemptions')
    .insert({
      tenant_id: input.tenantId,
      promotion_id: promotion.id,
      customer_id: input.customerId,
      status: 'completed',
      amount_applied_cents: amountCents,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (redemptionError) {
    return { ok: false, error: redemptionError.message };
  }

  const grant = await grantCustomerWalletCredit(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    amountCents,
    promotionId: promotion.id,
    promotionRedemptionId: redemption.id,
    note: `Referral reward (${input.recipient}): ${promotion.name}`,
  });

  const { error: eventError } = await admin.from('referral_reward_events').insert({
    tenant_id: input.tenantId,
    attribution_id: input.attributionId,
    recipient: input.recipient,
    customer_id: input.customerId,
    promotion_id: promotion.id,
    amount_applied_cents: amountCents,
    promotion_redemption_id: redemption.id,
    wallet_transaction_id: grant.transactionId,
  });

  if (eventError) {
    return { ok: false, error: eventError.message };
  }

  return { ok: true, amountCents };
}
