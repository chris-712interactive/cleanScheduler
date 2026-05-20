import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { manualPaymentMethodLabel } from '@/lib/billing/manualPaymentAudit';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface PaymentReconciliationMethodRow {
  method: string;
  paymentCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
}

export interface PaymentReconciliationDetailRow {
  paymentId: string;
  recordedAt: string;
  method: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  recordedVia: string;
}

export interface PaymentReconciliationResult {
  byMethod: PaymentReconciliationMethodRow[];
  details: PaymentReconciliationDetailRow[];
  summary: ReportSummaryLine[];
}

export async function runPaymentReconciliationReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<PaymentReconciliationResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      'id, amount_cents, method, recorded_at, recorded_via, stripe_fee_cents, net_amount_cents, gross_amount_cents',
    )
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false });

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query.limit(2000);
  if (error || !data) {
    return { byMethod: [], details: [], summary: [{ label: 'Payments', value: '0' }] };
  }

  const methodMap = new Map<
    string,
    { count: number; gross: number; fee: number; net: number }
  >();
  const details: PaymentReconciliationDetailRow[] = [];

  for (const row of data) {
    if (row.amount_cents <= 0) continue;

    const fee = row.stripe_fee_cents ?? 0;
    const net =
      row.net_amount_cents ??
      row.gross_amount_cents ??
      row.amount_cents - fee;
    const gross = row.gross_amount_cents ?? row.amount_cents;

    const key = row.method;
    const prev = methodMap.get(key) ?? { count: 0, gross: 0, fee: 0, net: 0 };
    prev.count += 1;
    prev.gross += gross;
    prev.fee += fee;
    prev.net += net;
    methodMap.set(key, prev);

    details.push({
      paymentId: row.id,
      recordedAt: row.recorded_at,
      method: manualPaymentMethodLabel(row.method),
      amountCents: gross,
      feeCents: fee,
      netCents: net,
      recordedVia: row.recorded_via,
    });
  }

  const byMethod: PaymentReconciliationMethodRow[] = [...methodMap.entries()]
    .map(([method, v]) => ({
      method: manualPaymentMethodLabel(method),
      paymentCount: v.count,
      grossCents: v.gross,
      feeCents: v.fee,
      netCents: v.net,
    }))
    .sort((a, b) => b.netCents - a.netCents);

  const totalNet = byMethod.reduce((s, r) => s + r.netCents, 0);
  const totalFees = byMethod.reduce((s, r) => s + r.feeCents, 0);

  return {
    byMethod,
    details,
    summary: [
      { label: 'Net collected', value: formatUsdFromCents(totalNet) },
      { label: 'Processing fees', value: formatUsdFromCents(totalFees) },
      { label: 'Payments', value: String(details.length) },
    ],
  };
}
