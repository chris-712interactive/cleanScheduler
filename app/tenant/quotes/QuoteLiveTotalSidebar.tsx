'use client';

import type { QuoteLineItemDraft } from '@/app/tenant/quotes/QuoteLineItemsEditor';
import type { QuoteHeaderPricingValues } from '@/app/tenant/quotes/QuoteHeaderPricingFields';
import { quoteLineDraftsForTotalsPreview } from '@/lib/tenant/parseQuoteLineDrafts';
import {
  parseDiscountDollarsToCents,
  parseDiscountPercentToBps,
  parsePercentStringToBps,
  parseQuoteDiscountKind,
  parseQuoteTaxMode,
} from '@/lib/tenant/quoteHeaderPricingForm';
import { computeQuoteTotals } from '@/lib/tenant/quoteTotals';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import styles from './quotes.module.scss';

export function QuoteLiveTotalSidebar({
  lineRows,
  pricing,
}: {
  lineRows: QuoteLineItemDraft[];
  pricing: QuoteHeaderPricingValues;
}) {
  const parsedLines = quoteLineDraftsForTotalsPreview(lineRows);
  const taxMode = parseQuoteTaxMode(pricing.taxMode);
  const taxPct = parsePercentStringToBps(pricing.taxRatePercent);
  const taxRateBps = taxMode === 'none' || !taxPct.ok ? 0 : taxPct.bps;

  const quoteDiscountKind = parseQuoteDiscountKind(pricing.quoteDiscountKind);
  let quoteDiscountValue = 0;
  if (quoteDiscountKind === 'percent') {
    const p = parseDiscountPercentToBps(pricing.quoteDiscountPercent);
    if (p.ok) quoteDiscountValue = p.bps;
  } else if (quoteDiscountKind === 'fixed_cents') {
    const d = parseDiscountDollarsToCents(pricing.quoteDiscountDollars);
    if (d.ok) quoteDiscountValue = d.cents;
  }

  const totals = computeQuoteTotals({
    lines: parsedLines,
    header_subtotal_cents: parsedLines.length > 0 ? null : null,
    tax_mode: taxMode,
    tax_rate_bps: taxRateBps,
    quote_discount_kind: quoteDiscountKind,
    quote_discount_value: quoteDiscountValue,
  });

  const taxLabel =
    taxMode === 'exclusive' && taxRateBps > 0
      ? `Sales tax (${(taxRateBps / 100).toFixed(3).replace(/\.?0+$/, '')}%)`
      : null;

  return (
    <aside className={styles.quoteTotalSidebar} aria-label="Quote total">
      <h3 className={styles.quoteTotalTitle}>Quote total</h3>
      <p className={styles.hint}>Updates as you edit pricing</p>
      <dl className={styles.quoteTotalRows}>
        <div className={styles.quoteTotalRow}>
          <dt>Line subtotal</dt>
          <dd>{formatQuoteMoney(totals.subtotal_after_line_discounts)}</dd>
        </div>
        {totals.quote_discount_cents > 0 ? (
          <div className={styles.quoteTotalRow}>
            <dt>Quote discount</dt>
            <dd>−{formatQuoteMoney(totals.quote_discount_cents)}</dd>
          </div>
        ) : null}
        {taxLabel ? (
          <div className={styles.quoteTotalRow}>
            <dt>{taxLabel}</dt>
            <dd>+{formatQuoteMoney(totals.tax_cents)}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.quoteTotalFinal}>
        <span>Customer total</span>
        <strong>{formatQuoteMoney(totals.total_cents)}</strong>
      </div>
      {parsedLines.length === 0 ? (
        <p className={styles.hint}>Add at least one priced service line to set the quote total.</p>
      ) : null}
    </aside>
  );
}
