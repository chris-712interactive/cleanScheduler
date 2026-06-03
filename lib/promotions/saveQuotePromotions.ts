import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { applyWalletCreditToQuoteTotal } from '@/lib/promotions/applyWalletCreditToQuoteTotal';
import {
  persistQuotePromotionFields,
  resolveQuotePromotionFields,
  syncQuotePromotionRedemption,
  type QuotePromotionFields,
} from '@/lib/promotions/quotePromotions';
import { computeQuoteTotals, type QuoteTotalsBreakdown } from '@/lib/tenant/quoteTotals';

type Admin = SupabaseClient<Database>;

export type QuotePricingWithPromotionsInput = {
  tenantId: string;
  customerId: string;
  quoteId?: string | null;
  lines: Array<{
    amount_cents: number;
    line_discount_kind: Database['public']['Enums']['quote_line_discount_kind'];
    line_discount_value: number;
  }>;
  header_subtotal_cents: number | null;
  tax_mode: Database['public']['Enums']['quote_tax_mode'];
  tax_rate_bps: number;
  manualPricing: {
    quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
    quote_discount_value: number;
  };
  rawPromoCode: string;
  rawWalletCreditDollars: string;
};

export type QuotePricingWithPromotionsResult =
  | {
      ok: true;
      amountCents: number | null;
      promotionFields: QuotePromotionFields;
      totalsBeforeWallet: QuoteTotalsBreakdown;
    }
  | { ok: false; error: string };

export async function computeQuotePricingWithPromotions(
  admin: Admin,
  input: QuotePricingWithPromotionsInput,
): Promise<QuotePricingWithPromotionsResult> {
  const totalsBeforePromo = computeQuoteTotals({
    lines: input.lines,
    header_subtotal_cents: input.header_subtotal_cents,
    tax_mode: input.tax_mode,
    tax_rate_bps: input.tax_rate_bps,
    quote_discount_kind: 'none',
    quote_discount_value: 0,
  });

  const resolved = await resolveQuotePromotionFields(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    quoteId: input.quoteId,
    rawPromoCode: input.rawPromoCode,
    rawWalletCreditDollars: input.rawWalletCreditDollars,
    manualPricing: input.manualPricing,
    subtotalBeforeQuoteDiscountCents: totalsBeforePromo.subtotal_after_line_discounts,
  });

  if (!resolved.ok) return resolved;

  const totalsBeforeWallet = computeQuoteTotals({
    lines: input.lines,
    header_subtotal_cents: input.header_subtotal_cents,
    tax_mode: input.tax_mode,
    tax_rate_bps: input.tax_rate_bps,
    quote_discount_kind: resolved.fields.quote_discount_kind,
    quote_discount_value: resolved.fields.quote_discount_value,
  });

  const withWallet = applyWalletCreditToQuoteTotal(
    totalsBeforeWallet,
    resolved.fields.wallet_credit_applied_cents,
  );

  const promotionFields: QuotePromotionFields = {
    ...resolved.fields,
    wallet_credit_applied_cents: withWallet.wallet_credit_applied_cents,
  };

  const hasLines = input.lines.length > 0;
  const amountCents =
    !hasLines && input.header_subtotal_cents == null && withWallet.total_cents === 0
      ? null
      : withWallet.total_cents;

  return {
    ok: true,
    amountCents,
    promotionFields,
    totalsBeforeWallet,
  };
}

export async function saveQuotePromotionSideEffects(
  admin: Admin,
  input: {
    tenantId: string;
    quoteId: string;
    customerId: string;
    promotionFields: QuotePromotionFields;
    quoteDiscountCents: number;
  },
): Promise<void> {
  await persistQuotePromotionFields(admin, {
    tenantId: input.tenantId,
    quoteId: input.quoteId,
    fields: input.promotionFields,
  });

  await syncQuotePromotionRedemption(admin, {
    tenantId: input.tenantId,
    quoteId: input.quoteId,
    customerId: input.customerId,
    promotionId: input.promotionFields.applied_promotion_id,
    discountAppliedCents: input.quoteDiscountCents,
  });
}
