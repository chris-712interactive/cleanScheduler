import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { manualPaymentMethodLabel } from '@/lib/billing/manualPaymentAudit';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface ProcessingFeesRow {
  periodMonth: string;
  method: string;
  paymentCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
}

export interface ProcessingFeesResult {
  rows: ProcessingFeesRow[];
  summary: ReportSummaryLine[];
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export async function runProcessingFeesReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<ProcessingFeesResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      'amount_cents, method, recorded_at, stripe_fee_cents, net_amount_cents, gross_amount_cents',
    )
    .eq('tenant_id', tenantId)
    .gt('amount_cents', 0);

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query.limit(5000);
  if (error || !data?.length) {
    return {
      rows: [],
      summary: [
        { label: 'Total fees', value: '$0.00' },
        { label: 'Deductible (card fees)', value: '$0.00' },
      ],
    };
  }

  const map = new Map<string, { count: number; gross: number; fee: number; net: number }>();

  for (const row of data) {
    const fee = row.stripe_fee_cents ?? 0;
    const gross = row.gross_amount_cents ?? row.amount_cents;
    const net = row.net_amount_cents ?? gross - fee;
    const key = `${monthKey(row.recorded_at)}|${row.method}`;
    const prev = map.get(key) ?? { count: 0, gross: 0, fee: 0, net: 0 };
    prev.count += 1;
    prev.gross += gross;
    prev.fee += fee;
    prev.net += net;
    map.set(key, prev);
  }

  const rows: ProcessingFeesRow[] = [...map.entries()]
    .map(([key, v]) => {
      const [periodMonth = 'unknown', method = 'other'] = key.split('|');
      return {
        periodMonth,
        method: manualPaymentMethodLabel(method),
        paymentCount: v.count,
        grossCents: v.gross,
        feeCents: v.fee,
        netCents: v.net,
      };
    })
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth) || b.feeCents - a.feeCents);

  const totalFees = rows.reduce((s, r) => s + r.feeCents, 0);
  const cardFees = rows
    .filter((r) => r.method.toLowerCase().includes('card'))
    .reduce((s, r) => s + r.feeCents, 0);

  return {
    rows,
    summary: [
      { label: 'Total processing fees', value: formatUsdFromCents(totalFees) },
      { label: 'Card fees (deductible)', value: formatUsdFromCents(cardFees) },
      { label: 'Rows', value: String(rows.length) },
    ],
  };
}
