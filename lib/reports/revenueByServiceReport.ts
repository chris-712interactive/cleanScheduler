import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { effectiveLineSubtotalCents } from '@/lib/tenant/quoteTotals';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface RevenueByServiceRow {
  serviceLabel: string;
  lineCount: number;
  totalCents: number;
}

export interface RevenueByServiceResult {
  rows: RevenueByServiceRow[];
  summary: ReportSummaryLine[];
}

function normalizeServiceLabel(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : 'Unlabeled service';
}

export async function runRevenueByServiceReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<RevenueByServiceResult> {
  let quoteQuery = db
    .from('tenant_quotes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .is('superseded_by_quote_id', null);

  if (fromIso) quoteQuery = quoteQuery.gte('accepted_at', fromIso);
  if (toIso) quoteQuery = quoteQuery.lte('accepted_at', toIso);

  const { data: quotes, error: quoteError } = await quoteQuery;
  if (quoteError || !quotes?.length) {
    return {
      rows: [],
      summary: [
        { label: 'Accepted value', value: '$0.00' },
        { label: 'Note', value: 'Based on accepted quote line items' },
      ],
    };
  }

  const quoteIds = quotes.map((q) => q.id);
  const { data: lines, error: lineError } = await db
    .from('tenant_quote_line_items')
    .select('service_label, amount_cents, line_discount_kind, line_discount_value')
    .eq('tenant_id', tenantId)
    .in('quote_id', quoteIds);

  if (lineError || !lines) {
    return { rows: [], summary: [{ label: 'Accepted value', value: '$0.00' }] };
  }

  const map = new Map<string, { count: number; cents: number }>();

  for (const line of lines) {
    const key = normalizeServiceLabel(line.service_label);
    const cents = effectiveLineSubtotalCents({
      amount_cents: line.amount_cents,
      line_discount_kind: line.line_discount_kind,
      line_discount_value: line.line_discount_value,
    });
    const prev = map.get(key) ?? { count: 0, cents: 0 };
    prev.count += 1;
    prev.cents += cents;
    map.set(key, prev);
  }

  const rows: RevenueByServiceRow[] = [...map.entries()]
    .map(([serviceLabel, v]) => ({
      serviceLabel,
      lineCount: v.count,
      totalCents: v.cents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const total = rows.reduce((s, r) => s + r.totalCents, 0);

  return {
    rows,
    summary: [
      { label: 'Accepted value', value: formatUsdFromCents(total) },
      { label: 'Service lines', value: String(lines.length) },
      { label: 'Unique services', value: String(rows.length) },
    ],
  };
}
