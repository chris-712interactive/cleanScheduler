import type { QuoteLineItemDraft } from '@/app/tenant/quotes/QuoteLineItemsEditor';
import {
  parseDiscountDollarsToCents,
  parseDiscountPercentToBps,
} from '@/lib/tenant/quoteHeaderPricingForm';
import type { QuoteLineForTotal } from '@/lib/tenant/quoteTotals';

/** Converts in-progress line drafts to totals input; skips incomplete rows. */
export function quoteLineDraftsForTotalsPreview(drafts: QuoteLineItemDraft[]): QuoteLineForTotal[] {
  const lines: QuoteLineForTotal[] = [];

  for (const draft of drafts) {
    const service_label = draft.service_label.trim();
    const amountRaw = draft.amount_dollars.trim();
    if (!service_label && !amountRaw) continue;
    if (!amountRaw) continue;

    const n = Number(amountRaw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) continue;
    const amount_cents = Math.round(n * 100);
    if (!Number.isSafeInteger(amount_cents)) continue;

    let line_discount_value = 0;
    if (draft.line_discount_kind === 'percent') {
      const p = parseDiscountPercentToBps(draft.line_discount_input);
      if (!p.ok) continue;
      line_discount_value = p.bps;
    } else if (draft.line_discount_kind === 'fixed_cents') {
      const d = parseDiscountDollarsToCents(draft.line_discount_input);
      if (!d.ok) continue;
      line_discount_value = d.cents;
    }

    lines.push({
      amount_cents,
      line_discount_kind: draft.line_discount_kind,
      line_discount_value,
    });
  }

  return lines;
}
