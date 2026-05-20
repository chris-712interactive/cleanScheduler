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

export interface PaymentReconciliationPayoutRow {
  stripePayoutId: string;
  arrivalDate: string | null;
  status: string | null;
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
  stripePayoutId: string | null;
}

export interface PaymentReconciliationResult {
  connectComplete: boolean;
  byMethod: PaymentReconciliationMethodRow[];
  byPayout: PaymentReconciliationPayoutRow[];
  pendingCardNetCents: number;
  pendingCardCount: number;
  details: PaymentReconciliationDetailRow[];
  summary: ReportSummaryLine[];
}

export async function runPaymentReconciliationReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<PaymentReconciliationResult> {
  const { data: tenantRow } = await db
    .from('tenants')
    .select('stripe_connect_status')
    .eq('id', tenantId)
    .maybeSingle();

  const connectComplete = tenantRow?.stripe_connect_status === 'complete';

  let query = db
    .from('tenant_invoice_payments')
    .select(
      'id, amount_cents, method, recorded_at, recorded_via, stripe_fee_cents, net_amount_cents, gross_amount_cents, stripe_payout_id',
    )
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false });

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query.limit(2000);
  if (error || !data) {
    return emptyResult(connectComplete);
  }

  const methodMap = new Map<
    string,
    { count: number; gross: number; fee: number; net: number }
  >();
  const payoutMap = new Map<
    string,
    { count: number; gross: number; fee: number; net: number }
  >();
  let pendingCardNet = 0;
  let pendingCardCount = 0;
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

    if (row.method === 'card') {
      const payoutId = row.stripe_payout_id;
      if (payoutId) {
        const pPrev = payoutMap.get(payoutId) ?? { count: 0, gross: 0, fee: 0, net: 0 };
        pPrev.count += 1;
        pPrev.gross += gross;
        pPrev.fee += fee;
        pPrev.net += net;
        payoutMap.set(payoutId, pPrev);
      } else {
        pendingCardCount += 1;
        pendingCardNet += net;
      }
    }

    details.push({
      paymentId: row.id,
      recordedAt: row.recorded_at,
      method: manualPaymentMethodLabel(row.method),
      amountCents: gross,
      feeCents: fee,
      netCents: net,
      recordedVia: row.recorded_via,
      stripePayoutId: row.stripe_payout_id,
    });
  }

  const payoutMeta = new Map<string, { arrivalDate: string | null; status: string | null }>();
  const payoutIds = [...payoutMap.keys()];
  if (payoutIds.length > 0) {
    const { data: payouts } = await db
      .from('tenant_stripe_payouts')
      .select('stripe_payout_id, arrival_date, status')
      .eq('tenant_id', tenantId)
      .in('stripe_payout_id', payoutIds);

    for (const p of payouts ?? []) {
      payoutMeta.set(p.stripe_payout_id, {
        arrivalDate: p.arrival_date,
        status: p.status,
      });
    }
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

  const byPayout: PaymentReconciliationPayoutRow[] = [...payoutMap.entries()]
    .map(([stripePayoutId, v]) => {
      const meta = payoutMeta.get(stripePayoutId);
      return {
        stripePayoutId,
        arrivalDate: meta?.arrivalDate ?? null,
        status: meta?.status ?? null,
        paymentCount: v.count,
        grossCents: v.gross,
        feeCents: v.fee,
        netCents: v.net,
      };
    })
    .sort((a, b) => {
      const aDate = a.arrivalDate ?? '';
      const bDate = b.arrivalDate ?? '';
      return bDate.localeCompare(aDate);
    });

  const totalNet = byMethod.reduce((s, r) => s + r.netCents, 0);
  const totalFees = byMethod.reduce((s, r) => s + r.feeCents, 0);

  const summary: ReportSummaryLine[] = [
    { label: 'Net collected', value: formatUsdFromCents(totalNet) },
    { label: 'Processing fees', value: formatUsdFromCents(totalFees) },
    { label: 'Payments', value: String(details.length) },
  ];

  if (connectComplete && byPayout.length > 0) {
    summary.push({ label: 'Payout batches', value: String(byPayout.length) });
  }
  if (pendingCardCount > 0) {
    summary.push({
      label: 'Card (pending payout)',
      value: `${pendingCardCount} · ${formatUsdFromCents(pendingCardNet)}`,
    });
  }

  return {
    connectComplete,
    byMethod,
    byPayout,
    pendingCardNetCents: pendingCardNet,
    pendingCardCount,
    details,
    summary,
  };
}

function emptyResult(connectComplete: boolean): PaymentReconciliationResult {
  return {
    connectComplete,
    byMethod: [],
    byPayout: [],
    pendingCardNetCents: 0,
    pendingCardCount: 0,
    details: [],
    summary: [{ label: 'Payments', value: '0' }],
  };
}
