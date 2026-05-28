import type { Database } from '@/lib/supabase/database.types';

export type QuoteLinePricingMethod = Database['public']['Enums']['quote_line_pricing_method'];

export const QUOTE_LINE_PRICING_METHOD_OPTIONS: {
  value: QuoteLinePricingMethod;
  label: string;
}[] = [
  { value: 'flat', label: 'Flat rate' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_sqft', label: 'Per sq ft' },
];

export function parseQuoteLinePricingMethod(raw: string): QuoteLinePricingMethod {
  const t = raw.trim() as QuoteLinePricingMethod;
  return t === 'hourly' || t === 'per_sqft' ? t : 'flat';
}

export function quoteLinePricingMethodLabel(method: QuoteLinePricingMethod): string {
  return QUOTE_LINE_PRICING_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? 'Flat rate';
}
