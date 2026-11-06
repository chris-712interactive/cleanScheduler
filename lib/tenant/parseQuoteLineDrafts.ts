import type { QuoteLineItemDraft } from '@/app/tenant/quotes/QuoteLineItemsEditor';
import {
  parseDiscountDollarsToCents,
  parseDiscountPercentToBps,
} from '@/lib/tenant/quoteHeaderPricingForm';
import type { QuoteLineForTotal } from '@/lib/tenant/quoteTotals';
import { computeSqftBid } from '@/lib/tenant/sqftBid';

/** Converts in-progress line drafts to totals input; skips incomplete rows. */
export function quoteLineDraftsForTotalsPreview(drafts: QuoteLineItemDraft[]): QuoteLineForTotal[] {
  const lines: QuoteLineForTotal[] = [];

  for (const draft of drafts) {
    const service_label = draft.service_label.trim();
    const amountRaw = draft.amount_dollars.trim();
    const sqftRateRaw = draft.sqft_rate_dollars?.trim() ?? '';
    if (!service_label && !amountRaw && !sqftRateRaw) continue;

    let amount_cents = 0;
    if (draft.pricing_method === 'per_sqft') {
      const rate = Number(sqftRateRaw.replace(/,/g, ''));
      const sqft = Number((draft.billable_sqft ?? '').replace(/,/g, ''));
      if (!sqftRateRaw || !Number.isInteger(sqft) || sqft <= 0) continue;
      const optional = (raw: string | undefined) => {
        const trimmed = raw?.trim() ?? '';
        if (!trimmed) return null;
        const value = Number(trimmed.replace(/,/g, ''));
        return Number.isFinite(value) && value > 0 ? value : null;
      };
      const bid = computeSqftBid({
        rateCentsPerSqft: Math.round(rate * 100),
        sqft,
        frequency: draft.frequency,
        timesPerWeek: optional(draft.times_per_week),
        timesPerMonth: optional(draft.times_per_month),
        productionSqftPerHour: optional(draft.production_sqft_per_hour),
      });
      if (!bid.ok) continue;
      amount_cents = bid.breakdown.amountCents;
    } else {
      if (!amountRaw) continue;
      const n = Number(amountRaw.replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) continue;
      amount_cents = Math.round(n * 100);
      if (!Number.isSafeInteger(amount_cents)) continue;
    }

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
