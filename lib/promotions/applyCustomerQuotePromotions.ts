import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerPromotionsEnabledForTenant } from '@/lib/promotions/loadCustomerWalletPortal';
import {
  computeQuotePricingWithPromotions,
  saveQuotePromotionSideEffects,
} from '@/lib/promotions/saveQuotePromotions';

type Admin = SupabaseClient<Database>;

type QuoteLineRow = {
  amount_cents: number;
  line_discount_kind: Database['public']['Enums']['quote_line_discount_kind'];
  line_discount_value: number;
};

export type ApplyCustomerQuotePromotionsResult =
  | {
      ok: true;
      amountCents: number | null;
      appliedPromoCode: string | null;
      walletCreditAppliedCents: number;
    }
  | { ok: false; error: string };

export async function applyCustomerQuotePromotions(
  admin: Admin,
  input: {
    tenantId: string;
    quoteId: string;
    customerId: string;
    rawPromoCode: string;
    rawWalletCreditDollars: string;
  },
): Promise<ApplyCustomerQuotePromotionsResult> {
  const promotionsEnabled = await customerPromotionsEnabledForTenant(admin, input.tenantId);
  if (!promotionsEnabled) {
    return { ok: false, error: 'Promotions are not available for this provider.' };
  }

  const { data: quote, error: quoteError } = await admin
    .from('tenant_quotes')
    .select(
      `
      id,
      tenant_id,
      customer_id,
      status,
      is_locked,
      amount_cents,
      tax_mode,
      tax_rate_bps,
      quote_discount_kind,
      quote_discount_value,
      tenant_quote_line_items (
        amount_cents,
        line_discount_kind,
        line_discount_value,
        sort_order
      )
    `,
    )
    .eq('id', input.quoteId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (quoteError || !quote) {
    return { ok: false, error: 'Quote not found.' };
  }

  if (quote.customer_id !== input.customerId) {
    return { ok: false, error: 'Quote not found.' };
  }

  if (quote.status !== 'sent') {
    return { ok: false, error: 'This quote is not open for promotion changes.' };
  }

  if (quote.is_locked) {
    return { ok: false, error: 'This quote is no longer open for changes.' };
  }

  const lines = [...(quote.tenant_quote_line_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  ) as QuoteLineRow[];

  const hasLines = lines.length > 0;
  const headerSubtotal = !hasLines ? quote.amount_cents : null;

  const priced = await computeQuotePricingWithPromotions(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    quoteId: input.quoteId,
    lines: lines.map((line) => ({
      amount_cents: line.amount_cents,
      line_discount_kind: line.line_discount_kind,
      line_discount_value: line.line_discount_value,
    })),
    header_subtotal_cents: headerSubtotal,
    tax_mode: quote.tax_mode,
    tax_rate_bps: quote.tax_rate_bps,
    manualPricing: {
      quote_discount_kind: quote.quote_discount_kind,
      quote_discount_value: quote.quote_discount_value,
    },
    rawPromoCode: input.rawPromoCode,
    rawWalletCreditDollars: input.rawWalletCreditDollars,
  });

  if (!priced.ok) {
    return priced;
  }

  const { error: updateError } = await admin
    .from('tenant_quotes')
    .update({
      amount_cents: priced.amountCents,
      quote_discount_kind: priced.promotionFields.quote_discount_kind,
      quote_discount_value: priced.promotionFields.quote_discount_value,
    })
    .eq('id', input.quoteId)
    .eq('tenant_id', input.tenantId)
    .eq('status', 'sent');

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await saveQuotePromotionSideEffects(admin, {
    tenantId: input.tenantId,
    quoteId: input.quoteId,
    customerId: input.customerId,
    promotionFields: priced.promotionFields,
    quoteDiscountCents: priced.totalsBeforeWallet.quote_discount_cents,
  });

  return {
    ok: true,
    amountCents: priced.amountCents,
    appliedPromoCode: priced.promotionFields.applied_promo_code,
    walletCreditAppliedCents: priced.promotionFields.wallet_credit_applied_cents,
  };
}
