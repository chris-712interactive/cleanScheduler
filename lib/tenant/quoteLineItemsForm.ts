import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { parseQuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';

export interface ParsedQuoteLineItem {
  sort_order: number;
  service_label: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string | null;
  amount_cents: number;
}

function parseDollarsToCents(raw: string): { ok: true; cents: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: false, error: 'Each service line needs an amount.' };
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a valid amount for each service line.' };
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents)) return { ok: false, error: 'Amount too large on a service line.' };
  return { ok: true, cents };
}

/**
 * Reads parallel `line_*` fields from FormData (see QuoteLineItemsEditor).
 * Drops completely blank rows. Validates non-empty lines.
 */
export function parseQuoteLineItemsFromForm(formData: FormData):
  | { ok: true; lines: ParsedQuoteLineItem[]; total_cents: number }
  | { ok: false; error: string } {
  const services = formData.getAll('line_service').map((v) => String(v));
  const frequencies = formData.getAll('line_frequency').map((v) => String(v));
  const details = formData.getAll('line_frequency_detail').map((v) => String(v));
  const amounts = formData.getAll('line_amount').map((v) => String(v));

  const n = Math.max(services.length, frequencies.length, details.length, amounts.length);
  const lines: ParsedQuoteLineItem[] = [];

  for (let i = 0; i < n; i++) {
    const service_label = (services[i] ?? '').trim();
    const frequency = parseQuoteLineFrequency(frequencies[i] ?? '');
    const frequency_detail_raw = (details[i] ?? '').trim();
    const amountRaw = amounts[i] ?? '';

    const rowBlank = !service_label && !amountRaw.trim();
    if (rowBlank) continue;

    if (!service_label) {
      return { ok: false, error: 'Each service line needs a service name / type.' };
    }

    if (frequency === 'custom' && !frequency_detail_raw) {
      return { ok: false, error: 'Custom cadence lines need a short description (e.g. "Every other Thursday").' };
    }

    const parsed = parseDollarsToCents(amountRaw);
    if (!parsed.ok) return parsed;

    lines.push({
      sort_order: lines.length,
      service_label,
      frequency,
      frequency_detail: frequency_detail_raw ? frequency_detail_raw : null,
      amount_cents: parsed.cents,
    });
  }

  const total_cents = lines.reduce((s, l) => s + l.amount_cents, 0);
  return { ok: true, lines, total_cents };
}
