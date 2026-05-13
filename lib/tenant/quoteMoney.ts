import type { Database } from '@/lib/supabase/database.types';

/** Format stored cents for display (Stripe-style integer money). */
export function formatQuoteMoney(cents: number | null, currency = 'USD'): string {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Format line discount for tables (percent or fixed cents off). */
export function formatQuoteLineDiscountShort(
  kind: Database['public']['Enums']['quote_line_discount_kind'],
  value: number,
  currency = 'USD',
): string {
  if (kind === 'none' || value <= 0) return '—';
  if (kind === 'percent') return `${(value / 100).toFixed(2)}%`;
  return formatQuoteMoney(value, currency);
}
