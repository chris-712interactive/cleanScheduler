import type { ReferralRewardSideMode } from '@/lib/referrals/referralTypes';

export function referralRewardGrantsForSideMode(sideMode: ReferralRewardSideMode): {
  grantReferrer: boolean;
  grantReferee: boolean;
} {
  return {
    grantReferrer: sideMode === 'referrer_only' || sideMode === 'double_sided',
    grantReferee: sideMode === 'double_sided' || sideMode === 'referee_only',
  };
}

export function referralPromotionWalletAmountCents(promotion: {
  promotion_type: 'percent' | 'fixed_cents' | 'account_credit';
  promotion_value: number;
}): number | null {
  if (promotion.promotion_type === 'account_credit' || promotion.promotion_type === 'fixed_cents') {
    return promotion.promotion_value > 0 ? promotion.promotion_value : null;
  }
  return null;
}

export function isFirstPaidInvoiceForCustomer(paidInvoiceCount: number): boolean {
  return paidInvoiceCount === 1;
}
