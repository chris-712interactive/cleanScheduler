import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { normalizePromoCode } from '@/lib/promotions/normalizePromoCode';
import {
  debitCustomerWalletCredit,
  grantCustomerWalletCredit,
  getCustomerWalletBalanceCents,
} from '@/lib/promotions/customerWallet';
import {
  quoteDiscountFromPromotion,
  validatePromotionForCustomer,
} from '@/lib/promotions/validatePromotion';

type Admin = SupabaseClient<Database>;

export type QuotePromotionFields = {
  applied_promotion_id: string | null;
  applied_promo_code: string | null;
  wallet_credit_applied_cents: number;
  quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
  quote_discount_value: number;
};

export type ResolveQuotePromotionInput = {
  tenantId: string;
  customerId: string;
  quoteId?: string | null;
  rawPromoCode: string;
  rawWalletCreditDollars: string;
  manualPricing: {
    quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
    quote_discount_value: number;
  };
  subtotalBeforeQuoteDiscountCents: number;
};

export type ResolveQuotePromotionResult =
  | { ok: true; fields: QuotePromotionFields; accountCreditGrantedCents?: number }
  | { ok: false; error: string };

export async function resolveQuotePromotionFields(
  admin: Admin,
  input: ResolveQuotePromotionInput,
): Promise<ResolveQuotePromotionResult> {
  const promoRaw = input.rawPromoCode.trim();
  const walletParsed = parseWalletCreditDollars(input.rawWalletCreditDollars);

  if (!walletParsed.ok) {
    return { ok: false, error: walletParsed.error };
  }

  const walletCreditCents = walletParsed.cents;
  if (walletCreditCents > 0) {
    const balance = await getCustomerWalletBalanceCents(admin, input.tenantId, input.customerId);
    if (walletCreditCents > balance) {
      return {
        ok: false,
        error: `Wallet credit exceeds available balance ($${(balance / 100).toFixed(2)}).`,
      };
    }
  }

  if (!promoRaw) {
    return {
      ok: true,
      fields: {
        applied_promotion_id: null,
        applied_promo_code: null,
        wallet_credit_applied_cents: walletCreditCents,
        quote_discount_kind: input.manualPricing.quote_discount_kind,
        quote_discount_value: input.manualPricing.quote_discount_value,
      },
    };
  }

  const validated = await validatePromotionForCustomer(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    rawCode: promoRaw,
    subtotalBeforeQuoteDiscountCents: input.subtotalBeforeQuoteDiscountCents,
    forQuoteDiscount: true,
  });

  if (!validated.ok) {
    return validated;
  }

  const { promotion } = validated;
  const normalizedCode = normalizePromoCode(promoRaw);

  if (promotion.promotion_type === 'account_credit') {
    return {
      ok: false,
      error: 'Use “Redeem credit code” to add account credit — this field is for quote discounts.',
    };
  }

  const discount = quoteDiscountFromPromotion(promotion);

  return {
    ok: true,
    fields: {
      applied_promotion_id: promotion.id,
      applied_promo_code: normalizedCode,
      wallet_credit_applied_cents: walletCreditCents,
      quote_discount_kind: discount.quote_discount_kind,
      quote_discount_value: discount.quote_discount_value,
    },
  };
}

export async function redeemAccountCreditPromotionForCustomer(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    rawCode: string;
  },
): Promise<
  { ok: true; grantedCents: number; balanceAfterCents: number } | { ok: false; error: string }
> {
  const validated = await validatePromotionForCustomer(admin, {
    tenantId: input.tenantId,
    customerId: input.customerId,
    rawCode: input.rawCode,
  });

  if (!validated.ok) return validated;

  const { promotion } = validated;
  if (promotion.promotion_type !== 'account_credit') {
    return { ok: false, error: 'This code is a quote discount, not account credit.' };
  }

  if (promotion.promotion_value <= 0) {
    return { ok: false, error: 'This promotion has no credit value configured.' };
  }

  const { data: redemption, error: redemptionError } = await admin
    .from('tenant_promotion_redemptions')
    .insert({
      tenant_id: input.tenantId,
      promotion_id: promotion.id,
      customer_id: input.customerId,
      status: 'completed',
      amount_applied_cents: promotion.promotion_value,
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
    amountCents: promotion.promotion_value,
    promotionId: promotion.id,
    promotionRedemptionId: redemption.id,
    note: `Promo code ${normalizePromoCode(input.rawCode)}`,
  });

  return {
    ok: true,
    grantedCents: promotion.promotion_value,
    balanceAfterCents: grant.balanceAfterCents,
  };
}

export async function syncQuotePromotionRedemption(
  admin: Admin,
  input: {
    tenantId: string;
    quoteId: string;
    customerId: string;
    promotionId: string | null;
    discountAppliedCents: number;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from('tenant_promotion_redemptions')
    .select('id, promotion_id, status')
    .eq('quote_id', input.quoteId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!input.promotionId) {
    if (existing) {
      await admin
        .from('tenant_promotion_redemptions')
        .update({ status: 'voided', voided_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return;
  }

  if (existing && existing.promotion_id === input.promotionId) {
    await admin
      .from('tenant_promotion_redemptions')
      .update({ amount_applied_cents: input.discountAppliedCents })
      .eq('id', existing.id);
    return;
  }

  if (existing) {
    await admin
      .from('tenant_promotion_redemptions')
      .update({ status: 'voided', voided_at: new Date().toISOString() })
      .eq('id', existing.id);
  }

  const { error } = await admin.from('tenant_promotion_redemptions').insert({
    tenant_id: input.tenantId,
    promotion_id: input.promotionId,
    customer_id: input.customerId,
    quote_id: input.quoteId,
    status: 'pending',
    amount_applied_cents: input.discountAppliedCents,
  });

  if (error) throw new Error(error.message);
}

export async function persistQuotePromotionFields(
  admin: Admin,
  input: {
    tenantId: string;
    quoteId: string;
    fields: QuotePromotionFields;
  },
): Promise<void> {
  const { error } = await admin
    .from('tenant_quotes')
    .update({
      applied_promotion_id: input.fields.applied_promotion_id,
      applied_promo_code: input.fields.applied_promo_code,
      wallet_credit_applied_cents: input.fields.wallet_credit_applied_cents,
    })
    .eq('id', input.quoteId)
    .eq('tenant_id', input.tenantId);

  if (error) throw new Error(error.message);
}

function parseWalletCreditDollars(
  raw: string,
): { ok: true; cents: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, cents: 0 };

  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Wallet credit must be a non-negative dollar amount.' };
  }

  return { ok: true, cents: Math.round(n * 100) };
}

export function parseWalletCreditDollarsFromForm(raw: string):
  | {
      ok: true;
      cents: number;
    }
  | { ok: false; error: string } {
  return parseWalletCreditDollars(raw);
}

export async function finalizeQuotePromotionsOnAccept(
  admin: Admin,
  input: {
    tenantId: string;
    quoteId: string;
    customerId: string;
  },
): Promise<void> {
  const { data: quote, error } = await admin
    .from('tenant_quotes')
    .select(
      'applied_promotion_id, wallet_credit_applied_cents, quote_discount_kind, quote_discount_value',
    )
    .eq('id', input.quoteId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (error || !quote) return;

  const walletCredit = quote.wallet_credit_applied_cents ?? 0;
  if (walletCredit > 0) {
    await debitCustomerWalletCredit(admin, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      amountCents: walletCredit,
      quoteId: input.quoteId,
      note: 'Applied to accepted quote',
    });
  }

  if (quote.applied_promotion_id) {
    const { data: pending } = await admin
      .from('tenant_promotion_redemptions')
      .select('id')
      .eq('quote_id', input.quoteId)
      .eq('promotion_id', quote.applied_promotion_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pending) {
      await admin
        .from('tenant_promotion_redemptions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', pending.id);
    } else {
      await admin.from('tenant_promotion_redemptions').insert({
        tenant_id: input.tenantId,
        promotion_id: quote.applied_promotion_id,
        customer_id: input.customerId,
        quote_id: input.quoteId,
        status: 'completed',
        amount_applied_cents: 0,
        completed_at: new Date().toISOString(),
      });
    }
  }
}
