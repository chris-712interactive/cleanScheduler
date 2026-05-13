import type { Database } from '@/lib/supabase/database.types';

export type QuoteTaxMode = Database['public']['Enums']['quote_tax_mode'];
export type QuoteDiscountKind = Database['public']['Enums']['quote_discount_kind'];
export type QuoteLineDiscountKind = Database['public']['Enums']['quote_line_discount_kind'];

export const QUOTE_LINE_DISCOUNT_OPTIONS: { value: QuoteLineDiscountKind; label: string }[] = [
  { value: 'none', label: 'No line discount' },
  { value: 'percent', label: 'Percent off line' },
  { value: 'fixed_cents', label: 'Fixed $ off line' },
];

const TAX_MODES = new Set<QuoteTaxMode>(['none', 'exclusive']);
const QUOTE_DISC = new Set<QuoteDiscountKind>(['none', 'percent', 'fixed_cents']);
const LINE_DISC = new Set<QuoteLineDiscountKind>(['none', 'percent', 'fixed_cents']);

export function parseQuoteLineDiscountKind(raw: string): QuoteLineDiscountKind {
  const t = raw.trim() as QuoteLineDiscountKind;
  return LINE_DISC.has(t) ? t : 'none';
}

export function parseQuoteTaxMode(raw: string): QuoteTaxMode {
  const t = raw.trim() as QuoteTaxMode;
  return TAX_MODES.has(t) ? t : 'none';
}

export function parseQuoteDiscountKind(raw: string): QuoteDiscountKind {
  const t = raw.trim() as QuoteDiscountKind;
  return QUOTE_DISC.has(t) ? t : 'none';
}

/** User-entered percent string (e.g. "8.875") → basis points (887). */
export function parsePercentStringToBps(raw: string): { ok: true; bps: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, bps: 0 };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid tax rate percent.' };
  if (n > 100) return { ok: false, error: 'Tax rate cannot exceed 100%.' };
  const bps = Math.round(n * 100);
  if (!Number.isSafeInteger(bps)) return { ok: false, error: 'Tax rate too large.' };
  return { ok: true, bps };
}

/** User-entered percent for a discount (e.g. "10" = 10%) → basis points (1000). */
export function parseDiscountPercentToBps(raw: string): { ok: true; bps: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, bps: 0 };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid discount percent.' };
  if (n > 100) return { ok: false, error: 'Discount percent cannot exceed 100%.' };
  const bps = Math.round(n * 100);
  if (!Number.isSafeInteger(bps)) return { ok: false, error: 'Discount percent too large.' };
  return { ok: true, bps };
}

export function parseDiscountDollarsToCents(raw: string): { ok: true; cents: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, cents: 0 };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid discount amount.' };
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents)) return { ok: false, error: 'Discount amount too large.' };
  return { ok: true, cents };
}
