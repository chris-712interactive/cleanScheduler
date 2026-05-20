import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface QuotePipelineStatusRow {
  status: string;
  count: number;
  totalCents: number;
}

export interface QuotePipelineResult {
  byStatus: QuotePipelineStatusRow[];
  summary: ReportSummaryLine[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

export async function runQuotePipelineReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<QuotePipelineResult> {
  let query = db
    .from('tenant_quotes')
    .select('status, amount_cents')
    .eq('tenant_id', tenantId)
    .is('superseded_by_quote_id', null);

  if (fromIso) query = query.gte('created_at', fromIso);
  if (toIso) query = query.lte('created_at', toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { byStatus: [], summary: [{ label: 'Quotes', value: '0' }] };
  }

  const map = new Map<string, { count: number; total: number }>();
  for (const row of data) {
    const prev = map.get(row.status) ?? { count: 0, total: 0 };
    prev.count += 1;
    prev.total += row.amount_cents ?? 0;
    map.set(row.status, prev);
  }

  const byStatus: QuotePipelineStatusRow[] = [...map.entries()]
    .map(([status, v]) => ({
      status: STATUS_LABEL[status] ?? status,
      count: v.count,
      totalCents: v.total,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const totalQuotes = data.length;
  const pipelineCents = data.reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  return {
    byStatus,
    summary: [
      { label: 'Quotes', value: String(totalQuotes) },
      { label: 'Pipeline value', value: formatUsdFromCents(pipelineCents) },
      {
        label: 'Accepted',
        value: String(byStatus.find((r) => r.status === 'Accepted')?.count ?? 0),
      },
    ],
  };
}
