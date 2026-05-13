import { parseQuoteLineFrequency, type QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';

/** One line from `tenant_quote_acceptance_snapshots.payload.line_items` (JSON). */
export type AcceptanceSnapshotLine = {
  sort_order: number;
  service_label: string;
  frequency: QuoteLineFrequency;
  frequency_detail: string | null;
  amount_cents: number;
};

/**
 * Parses `payload.line_items` from an acceptance snapshot JSON document.
 * Returns an empty array if missing or invalid (caller may treat as “no lines captured”).
 */
export function parseAcceptanceSnapshotLines(payload: unknown): AcceptanceSnapshotLine[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const raw = (payload as { line_items?: unknown }).line_items;
  if (!Array.isArray(raw)) return [];

  const out: AcceptanceSnapshotLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const sort_order = Number(o.sort_order);
    const service_label = String(o.service_label ?? '').trim();
    const frequency = parseQuoteLineFrequency(String(o.frequency ?? ''));
    const fd = o.frequency_detail;
    const frequency_detail =
      fd == null || fd === '' ? null : String(fd).trim() || null;
    const amount_cents = Number(o.amount_cents);
    if (!service_label || !Number.isFinite(amount_cents) || amount_cents < 0) continue;
    out.push({
      sort_order: Number.isFinite(sort_order) ? sort_order : out.length,
      service_label,
      frequency,
      frequency_detail,
      amount_cents: Math.round(amount_cents),
    });
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}
