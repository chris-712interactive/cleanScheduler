import type { Tables } from '@/lib/supabase/database.types';

export interface QuoteHeaderPricingDefaults {
  taxMode: Tables<'tenant_quotes'>['tax_mode'];
  taxRatePercent: string;
  quoteDiscountKind: Tables<'tenant_quotes'>['quote_discount_kind'];
  quoteDiscountPercent: string;
  quoteDiscountDollars: string;
}

export function quoteHeaderPricingDefaultsFromQuote(
  q: Pick<
    Tables<'tenant_quotes'>,
    'tax_mode' | 'tax_rate_bps' | 'quote_discount_kind' | 'quote_discount_value'
  >,
): QuoteHeaderPricingDefaults {
  const taxRatePercent =
    q.tax_mode === 'exclusive' && q.tax_rate_bps > 0 ? String(q.tax_rate_bps / 100) : '';
  let quoteDiscountPercent = '';
  let quoteDiscountDollars = '';
  if (q.quote_discount_kind === 'percent' && q.quote_discount_value > 0) {
    quoteDiscountPercent = String(q.quote_discount_value / 100);
  } else if (q.quote_discount_kind === 'fixed_cents' && q.quote_discount_value > 0) {
    quoteDiscountDollars = (q.quote_discount_value / 100).toFixed(2);
  }
  return {
    taxMode: q.tax_mode,
    taxRatePercent,
    quoteDiscountKind: q.quote_discount_kind,
    quoteDiscountPercent,
    quoteDiscountDollars,
  };
}
