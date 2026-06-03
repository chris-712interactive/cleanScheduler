import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getCustomerWalletBalanceCents } from '@/lib/promotions/customerWallet';
import { customerPromotionsEnabledForTenant } from '@/lib/promotions/loadCustomerWalletPortal';
import { normalizePromoCode } from '@/lib/promotions/normalizePromoCode';
import { syncInvoicePromotionRedemption } from '@/lib/promotions/syncInvoicePromotionRedemption';
import {
  quoteDiscountFromPromotion,
  validatePromotionForCustomer,
} from '@/lib/promotions/validatePromotion';
import {
  invoiceCollectibleCents,
  invoiceUnpaidBalanceCents,
} from '@/lib/promotions/invoiceCollectible';

type Admin = SupabaseClient<Database>;

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

export type ApplyCustomerInvoicePromotionsResult =
  | {
      ok: true;
      promoDiscountCents: number;
      walletCreditAppliedCents: number;
      collectibleCents: number;
      appliedPromoCode: string | null;
    }
  | { ok: false; error: string };

export async function applyCustomerInvoicePromotions(
  admin: Admin,
  input: {
    tenantId: string;
    invoiceId: string;
    customerId: string;
    rawPromoCode: string;
    rawWalletCreditDollars: string;
  },
): Promise<ApplyCustomerInvoicePromotionsResult> {
  const promotionsEnabled = await customerPromotionsEnabledForTenant(admin, input.tenantId);
  if (!promotionsEnabled) {
    return { ok: false, error: 'Promotions are not available for this provider.' };
  }

  const { data: invoice, error: invoiceError } = await admin
    .from('tenant_invoices')
    .select(
      'id, tenant_id, customer_id, status, amount_cents, amount_paid_cents, hosted_invoice_url',
    )
    .eq('id', input.invoiceId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { ok: false, error: 'Invoice not found.' };
  }

  if (invoice.customer_id !== input.customerId) {
    return { ok: false, error: 'Invoice not found.' };
  }

  if (invoice.status === 'void' || invoice.status === 'paid') {
    return { ok: false, error: 'This invoice is not open for promotion changes.' };
  }

  if (invoice.hosted_invoice_url?.trim()) {
    return {
      ok: false,
      error:
        'Use the Stripe invoice link to pay this invoice — promo codes cannot be applied here.',
    };
  }

  const unpaid = invoiceUnpaidBalanceCents(invoice);
  if (unpaid <= 0) {
    return { ok: false, error: 'This invoice has no remaining balance.' };
  }

  const walletParsed = parseWalletCreditDollars(input.rawWalletCreditDollars);
  if (!walletParsed.ok) return walletParsed;

  let promoDiscountCents = 0;
  let appliedPromotionId: string | null = null;
  let appliedPromoCode: string | null = null;

  const promoRaw = input.rawPromoCode.trim();
  if (promoRaw) {
    const validated = await validatePromotionForCustomer(admin, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      rawCode: promoRaw,
      subtotalBeforeQuoteDiscountCents: unpaid,
      forQuoteDiscount: true,
    });

    if (!validated.ok) return validated;

    if (validated.promotion.promotion_type === 'account_credit') {
      return {
        ok: false,
        error:
          'Use a discount code here — account credit codes are redeemed from your wallet balance.',
      };
    }

    const discount = quoteDiscountFromPromotion(validated.promotion);
    if (discount.quote_discount_kind === 'percent') {
      promoDiscountCents = Math.round((unpaid * discount.quote_discount_value) / 10000);
    } else {
      promoDiscountCents = Math.min(unpaid, discount.quote_discount_value);
    }

    appliedPromotionId = validated.promotion.id;
    appliedPromoCode = normalizePromoCode(promoRaw);
  }

  const afterPromo = Math.max(0, unpaid - promoDiscountCents);
  let walletCreditCents = walletParsed.cents;
  if (walletCreditCents > 0) {
    const balance = await getCustomerWalletBalanceCents(admin, input.tenantId, input.customerId);
    if (walletCreditCents > balance) {
      return {
        ok: false,
        error: `Wallet credit exceeds available balance ($${(balance / 100).toFixed(2)}).`,
      };
    }
    if (walletCreditCents > afterPromo) {
      walletCreditCents = afterPromo;
    }
  }

  const collectibleCents = Math.max(0, afterPromo - walletCreditCents);

  const { error: updateError } = await admin
    .from('tenant_invoices')
    .update({
      applied_promotion_id: appliedPromotionId,
      applied_promo_code: appliedPromoCode,
      promo_discount_cents: promoDiscountCents,
      wallet_credit_applied_cents: walletCreditCents,
    })
    .eq('id', input.invoiceId)
    .eq('tenant_id', input.tenantId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await syncInvoicePromotionRedemption(admin, {
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    promotionId: appliedPromotionId,
    discountAppliedCents: promoDiscountCents,
  });

  return {
    ok: true,
    promoDiscountCents,
    walletCreditAppliedCents: walletCreditCents,
    collectibleCents,
    appliedPromoCode,
  };
}

export function invoicePromotionDefaults(invoice: {
  applied_promo_code?: string | null;
  wallet_credit_applied_cents?: number | null;
}): { promoCode: string; walletCreditDollars: string } {
  const wallet = invoice.wallet_credit_applied_cents ?? 0;
  return {
    promoCode: invoice.applied_promo_code ?? '',
    walletCreditDollars: wallet > 0 ? (wallet / 100).toFixed(2) : '',
  };
}

export { invoiceCollectibleCents };
