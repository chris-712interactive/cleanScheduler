import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';
import { manualPaymentMethodLabel } from '@/lib/billing/manualPaymentAudit';

export interface CollectionsMethodRow {
  method: string;
  paymentCount: number;
  grossCents: number;
  refundCents: number;
  netCents: number;
}

export interface CollectionsSummaryResult {
  byMethod: CollectionsMethodRow[];
  summary: ReportSummaryLine[];
}

export async function runCollectionsSummaryReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<CollectionsSummaryResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select('method, amount_cents')
    .eq('tenant_id', tenantId);

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { byMethod: [], summary: [{ label: 'Net collected', value: '$0.00' }] };
  }

  const map = new Map<string, { gross: number; refund: number; count: number }>();

  for (const row of data) {
    const key = row.method;
    const prev = map.get(key) ?? { gross: 0, refund: 0, count: 0 };
    if (row.amount_cents >= 0) {
      prev.gross += row.amount_cents;
      prev.count += 1;
    } else {
      prev.refund += Math.abs(row.amount_cents);
    }
    map.set(key, prev);
  }

  const byMethod: CollectionsMethodRow[] = [...map.entries()]
    .map(([method, v]) => ({
      method: manualPaymentMethodLabel(method),
      paymentCount: v.count,
      grossCents: v.gross,
      refundCents: v.refund,
      netCents: v.gross - v.refund,
    }))
    .sort((a, b) => b.netCents - a.netCents);

  const netTotal = byMethod.reduce((s, r) => s + r.netCents, 0);
  const refundTotal = byMethod.reduce((s, r) => s + r.refundCents, 0);

  return {
    byMethod,
    summary: [
      { label: 'Net collected', value: formatUsdFromCents(netTotal) },
      { label: 'Refunds', value: formatUsdFromCents(refundTotal) },
      { label: 'Payment methods', value: String(byMethod.length) },
    ],
  };
}
