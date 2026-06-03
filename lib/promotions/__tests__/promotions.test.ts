import { describe, expect, it } from 'vitest';
import { applyWalletCreditToQuoteTotal } from '@/lib/promotions/applyWalletCreditToQuoteTotal';
import { normalizePromoCode } from '@/lib/promotions/normalizePromoCode';
import { quoteDiscountFromPromotion } from '@/lib/promotions/validatePromotion';

describe('normalizePromoCode', () => {
  it('trims and uppercases codes', () => {
    expect(normalizePromoCode('  spring20  ')).toBe('SPRING20');
  });
});

describe('quoteDiscountFromPromotion', () => {
  it('maps percent promotions to bps discount', () => {
    expect(
      quoteDiscountFromPromotion({
        promotion_type: 'percent',
        promotion_value: 1000,
      } as never),
    ).toEqual({ quote_discount_kind: 'percent', quote_discount_value: 1000 });
  });

  it('maps fixed promotions to fixed cents', () => {
    expect(
      quoteDiscountFromPromotion({
        promotion_type: 'fixed_cents',
        promotion_value: 2500,
      } as never),
    ).toEqual({ quote_discount_kind: 'fixed_cents', quote_discount_value: 2500 });
  });
});

describe('applyWalletCreditToQuoteTotal', () => {
  it('caps wallet credit at quote total', () => {
    const result = applyWalletCreditToQuoteTotal(
      {
        subtotal_after_line_discounts: 10000,
        quote_discount_cents: 0,
        after_quote_discount: 10000,
        tax_cents: 0,
        total_cents: 10000,
      },
      15000,
    );
    expect(result).toEqual({ total_cents: 0, wallet_credit_applied_cents: 10000 });
  });

  it('leaves total unchanged when no credit applied', () => {
    const result = applyWalletCreditToQuoteTotal(
      {
        subtotal_after_line_discounts: 5000,
        quote_discount_cents: 0,
        after_quote_discount: 5000,
        tax_cents: 500,
        total_cents: 5500,
      },
      0,
    );
    expect(result).toEqual({ total_cents: 5500, wallet_credit_applied_cents: 0 });
  });
});
