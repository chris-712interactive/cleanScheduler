import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { normalizePromoCode } from '@/lib/promotions/normalizePromoCode';
import type { TenantPromotionRow } from '@/lib/promotions/promotionTypes';

type Admin = SupabaseClient<Database>;

export type ValidatePromotionResult =
  | { ok: true; promotion: TenantPromotionRow }
  | { ok: false; error: string };

function isWithinDateWindow(promotion: TenantPromotionRow, now: Date): boolean {
  if (promotion.valid_from) {
    const from = new Date(promotion.valid_from);
    if (!Number.isNaN(from.getTime()) && now < from) return false;
  }
  if (promotion.valid_until) {
    const until = new Date(promotion.valid_until);
    if (!Number.isNaN(until.getTime()) && now > until) return false;
  }
  return true;
}

async function countPromotionRedemptions(
  admin: Admin,
  promotionId: string,
  options?: {
    customerId?: string;
    statuses?: Database['public']['Enums']['tenant_promotion_redemption_status'][];
  },
): Promise<number> {
  const statuses = options?.statuses ?? ['pending', 'completed'];
  let q = admin
    .from('tenant_promotion_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promotion_id', promotionId)
    .in('status', statuses);

  if (options?.customerId) {
    q = q.eq('customer_id', options.customerId);
  }

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadPromotionByCode(
  admin: Admin,
  tenantId: string,
  rawCode: string,
): Promise<TenantPromotionRow | null> {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;

  const { data, error } = await admin
    .from('tenant_promotions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function validatePromotionForCustomer(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    rawCode: string;
    subtotalBeforeQuoteDiscountCents?: number;
    forQuoteDiscount?: boolean;
    now?: Date;
  },
): Promise<ValidatePromotionResult> {
  const promotion = await loadPromotionByCode(admin, input.tenantId, input.rawCode);
  if (!promotion) {
    return { ok: false, error: 'Promo code not found.' };
  }

  if (!promotion.is_active) {
    return { ok: false, error: 'This promo code is no longer active.' };
  }

  const now = input.now ?? new Date();
  if (!isWithinDateWindow(promotion, now)) {
    return { ok: false, error: 'This promo code is outside its valid date range.' };
  }

  if (input.forQuoteDiscount && promotion.promotion_type === 'account_credit') {
    return {
      ok: false,
      error: 'This code adds account credit. Redeem it separately — it does not discount quotes.',
    };
  }

  if (
    !input.forQuoteDiscount &&
    promotion.promotion_type !== 'account_credit' &&
    promotion.promotion_type !== 'percent' &&
    promotion.promotion_type !== 'fixed_cents'
  ) {
    return { ok: false, error: 'Unsupported promotion type.' };
  }

  const minPurchase = promotion.min_purchase_cents;
  if (
    minPurchase != null &&
    minPurchase > 0 &&
    input.subtotalBeforeQuoteDiscountCents != null &&
    input.subtotalBeforeQuoteDiscountCents < minPurchase
  ) {
    return {
      ok: false,
      error: `This code requires a minimum subtotal of $${(minPurchase / 100).toFixed(2)}.`,
    };
  }

  const globalCount = await countPromotionRedemptions(admin, promotion.id);
  if (promotion.usage_type === 'single_use' && globalCount >= 1) {
    return { ok: false, error: 'This promo code has already been used.' };
  }
  if (
    promotion.usage_type === 'limited' &&
    promotion.max_redemptions != null &&
    globalCount >= promotion.max_redemptions
  ) {
    return { ok: false, error: 'This promo code has reached its usage limit.' };
  }

  const customerCount = await countPromotionRedemptions(admin, promotion.id, {
    customerId: input.customerId,
  });
  if (
    (promotion.usage_type === 'single_use_per_customer' || promotion.usage_type === 'single_use') &&
    customerCount >= promotion.max_redemptions_per_customer
  ) {
    return { ok: false, error: 'This customer has already used this promo code.' };
  }

  return { ok: true, promotion };
}

export function quoteDiscountFromPromotion(promotion: TenantPromotionRow): {
  quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
  quote_discount_value: number;
} {
  if (promotion.promotion_type === 'percent') {
    return { quote_discount_kind: 'percent', quote_discount_value: promotion.promotion_value };
  }
  if (promotion.promotion_type === 'fixed_cents') {
    return { quote_discount_kind: 'fixed_cents', quote_discount_value: promotion.promotion_value };
  }
  return { quote_discount_kind: 'none', quote_discount_value: 0 };
}

export async function countCompletedPromotionRedemptions(
  admin: Admin,
  promotionId: string,
): Promise<number> {
  return countPromotionRedemptions(admin, promotionId, { statuses: ['completed'] });
}
