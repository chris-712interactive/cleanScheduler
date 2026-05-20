import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { invoiceRemainingCents } from '@/lib/billing/outstandingInvoices';
import { agingBucketForDueDate, daysOutstanding } from '@/lib/reports/aging';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import type { AgingBucket, ReportSummaryLine } from '@/lib/reports/types';
import { AGING_BUCKET_LABEL } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface OutstandingBalanceRow {
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceTitle: string;
  status: string;
  dueDate: string | null;
  remainingCents: number;
  agingBucket: AgingBucket;
  daysOutstanding: number | null;
}

export interface OutstandingBalancesResult {
  rows: OutstandingBalanceRow[];
  summary: ReportSummaryLine[];
  bucketTotals: Record<AgingBucket, number>;
}

export async function runOutstandingBalancesReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  asOfIso: string | null,
): Promise<OutstandingBalancesResult> {
  const asOfMs = asOfIso ? new Date(asOfIso).getTime() : Date.now();

  const { data, error } = await db
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      amount_paid_cents,
      due_date,
      customer_id,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'void');

  if (error || !data) {
    return emptyOutstandingResult();
  }

  const rows: OutstandingBalanceRow[] = [];
  const bucketTotals: Record<AgingBucket, number> = {
    current: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
    no_due_date: 0,
  };

  let totalCents = 0;

  for (const inv of data) {
    const remaining = invoiceRemainingCents(inv);
    if (remaining <= 0) continue;

    const bucket = agingBucketForDueDate(inv.due_date, asOfMs);
    bucketTotals[bucket] += remaining;
    totalCents += remaining;

    const ident = inv.customers?.customer_identities ?? null;
    rows.push({
      customerId: inv.customer_id,
      customerName: customerLabelFromIdentity(ident),
      invoiceId: inv.id,
      invoiceTitle: inv.title,
      status: inv.status,
      dueDate: inv.due_date,
      remainingCents: remaining,
      agingBucket: bucket,
      daysOutstanding: daysOutstanding(inv.due_date, asOfMs),
    });
  }

  rows.sort((a, b) => b.remainingCents - a.remainingCents);

  const summary: ReportSummaryLine[] = [
    { label: 'Total outstanding', value: formatUsdFromCents(totalCents) },
    { label: 'Open invoices', value: String(rows.length) },
    ...Object.entries(bucketTotals)
      .filter(([, cents]) => cents > 0)
      .map(([bucket, cents]) => ({
        label: AGING_BUCKET_LABEL[bucket as AgingBucket],
        value: formatUsdFromCents(cents),
      })),
  ];

  return { rows, summary, bucketTotals };
}

function emptyOutstandingResult(): OutstandingBalancesResult {
  return {
    rows: [],
    summary: [{ label: 'Total outstanding', value: '$0.00' }],
    bucketTotals: {
      current: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_90_plus: 0,
      no_due_date: 0,
    },
  };
}
