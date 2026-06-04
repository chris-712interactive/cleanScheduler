import { describe, expect, it } from 'vitest';
import {
  isFirstPaidInvoiceForCustomer,
  referralPromotionWalletAmountCents,
  referralRewardGrantsForSideMode,
} from '@/lib/referrals/referralQualificationRules';

describe('referralRewardGrantsForSideMode', () => {
  it('grants referrer only', () => {
    expect(referralRewardGrantsForSideMode('referrer_only')).toEqual({
      grantReferrer: true,
      grantReferee: false,
    });
  });

  it('grants both for double-sided', () => {
    expect(referralRewardGrantsForSideMode('double_sided')).toEqual({
      grantReferrer: true,
      grantReferee: true,
    });
  });

  it('grants referee only', () => {
    expect(referralRewardGrantsForSideMode('referee_only')).toEqual({
      grantReferrer: false,
      grantReferee: true,
    });
  });
});

describe('referralPromotionWalletAmountCents', () => {
  it('maps account credit and fixed amounts', () => {
    expect(
      referralPromotionWalletAmountCents({
        promotion_type: 'account_credit',
        promotion_value: 2500,
      }),
    ).toBe(2500);
    expect(
      referralPromotionWalletAmountCents({ promotion_type: 'fixed_cents', promotion_value: 1000 }),
    ).toBe(1000);
  });

  it('returns null for percent promotions without a base amount', () => {
    expect(
      referralPromotionWalletAmountCents({ promotion_type: 'percent', promotion_value: 1000 }),
    ).toBeNull();
  });

  it('calculates percent rewards from qualifying invoice base', () => {
    expect(
      referralPromotionWalletAmountCents(
        { promotion_type: 'percent', promotion_value: 1000 },
        50_000,
      ),
    ).toBe(5000);
  });
});

describe('isFirstPaidInvoiceForCustomer', () => {
  it('is true only when count is exactly one', () => {
    expect(isFirstPaidInvoiceForCustomer(1)).toBe(true);
    expect(isFirstPaidInvoiceForCustomer(0)).toBe(false);
    expect(isFirstPaidInvoiceForCustomer(2)).toBe(false);
  });
});
