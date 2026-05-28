import type { Database } from '@/lib/supabase/database.types';

export type QuoteTaxMode = Database['public']['Enums']['quote_tax_mode'];
export type QuoteDiscountKind = Database['public']['Enums']['quote_discount_kind'];
export type QuoteLineDiscountKind = Database['public']['Enums']['quote_line_discount_kind'];

export interface QuoteLineForTotal {
  amount_cents: number;
  line_discount_kind: QuoteLineDiscountKind;
  line_discount_value: number;
}

export interface ComputeQuoteTotalsInput {
  lines: QuoteLineForTotal[];
  /** When there are no line items, use this as the pre-discount subtotal (header-only quote). */
  header_subtotal_cents: number | null;
  tax_mode: QuoteTaxMode;
  tax_rate_bps: number;
  quote_discount_kind: QuoteDiscountKind;
  quote_discount_value: number;
}

export interface QuoteTotalsBreakdown {
  subtotal_after_line_discounts: number;
  quote_discount_cents: number;
  after_quote_discount: number;
  tax_cents: number;
  total_cents: number;
}

function clampBps(bps: number): number {
  if (!Number.isFinite(bps) || bps < 0) return 0;
  return Math.min(10_000, Math.round(bps));
}

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Line `amount_cents` is the pre-discount list amount when a line discount applies; otherwise it is the line total. */
export function effectiveLineSubtotalCents(line: QuoteLineForTotal): number {
  const gross = clampNonNegInt(line.amount_cents);
  if (line.line_discount_kind === 'none' || line.line_discount_value <= 0) return gross;
  if (line.line_discount_kind === 'fixed_cents') {
    return Math.max(0, gross - clampNonNegInt(line.line_discount_value));
  }
  const bps = clampBps(line.line_discount_value);
  return Math.round(gross * (1 - bps / 10_000));
}

export function computeQuoteTotals(input: ComputeQuoteTotalsInput): QuoteTotalsBreakdown {
  const lineSum =
    input.lines.length > 0
      ? input.lines.reduce((s, l) => s + effectiveLineSubtotalCents(l), 0)
      : input.header_subtotal_cents != null
        ? clampNonNegInt(input.header_subtotal_cents)
        : 0;

  let afterLines = lineSum;
  let quoteDiscountCents = 0;

  if (input.quote_discount_kind === 'percent' && input.quote_discount_value > 0) {
    const bps = clampBps(input.quote_discount_value);
    const after = Math.round(afterLines * (1 - bps / 10_000));
    quoteDiscountCents = Math.max(0, afterLines - after);
    afterLines = after;
  } else if (input.quote_discount_kind === 'fixed_cents' && input.quote_discount_value > 0) {
    const d = clampNonNegInt(input.quote_discount_value);
    quoteDiscountCents = Math.min(afterLines, d);
    afterLines = Math.max(0, afterLines - d);
  }

  let taxCents = 0;
  if (input.tax_mode === 'exclusive' && input.tax_rate_bps > 0 && afterLines > 0) {
    const r = clampBps(input.tax_rate_bps);
    taxCents = Math.round((afterLines * r) / 10_000);
  }

  const totalCents = afterLines + taxCents;

  return {
    subtotal_after_line_discounts: lineSum,
    quote_discount_cents: quoteDiscountCents,
    after_quote_discount: afterLines,
    tax_cents: taxCents,
    total_cents: totalCents,
  };
}
