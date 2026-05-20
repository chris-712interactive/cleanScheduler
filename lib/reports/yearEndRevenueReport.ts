import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface YearEndCustomerRow {
  customerId: string;
  customerName: string;
  paymentCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
}

export interface YearEndRevenueResult {
  rows: YearEndCustomerRow[];
  summary: ReportSummaryLine[];
}

export async function runYearEndRevenueReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<YearEndRevenueResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      `
      amount_cents,
      gross_amount_cents,
      stripe_fee_cents,
      net_amount_cents,
      tenant_invoices (
        customer_id,
        customers (
          customer_identities (
            first_name,
            last_name,
            full_name
          )
        )
      )
    `,
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
        { label: 'Gross collected', value: '$0.00' },
        { label: 'Net collected', value: '$0.00' },
      ],
    };
  }

  const map = new Map<
    string,
    { name: string; gross: number; fee: number; net: number; count: number }
  >();

  for (const row of data) {
    const invoice = row.tenant_invoices;
    if (!invoice?.customer_id) continue;
    const customerId = invoice.customer_id;
    const name = customerLabelFromIdentity(invoice.customers?.customer_identities ?? null);
    const gross = row.gross_amount_cents ?? row.amount_cents;
    const fee = row.stripe_fee_cents ?? 0;
    const net = row.net_amount_cents ?? gross - fee;
    const prev = map.get(customerId) ?? { name, gross: 0, fee: 0, net: 0, count: 0 };
    prev.count += 1;
    prev.gross += gross;
    prev.fee += fee;
    prev.net += net;
    map.set(customerId, prev);
  }

  const rows: YearEndCustomerRow[] = [...map.entries()]
    .map(([customerId, v]) => ({
      customerId,
      customerName: v.name,
      paymentCount: v.count,
      grossCents: v.gross,
      feeCents: v.fee,
      netCents: v.net,
    }))
    .sort((a, b) => b.grossCents - a.grossCents);

  const totalGross = rows.reduce((s, r) => s + r.grossCents, 0);
  const totalFees = rows.reduce((s, r) => s + r.feeCents, 0);
  const totalNet = rows.reduce((s, r) => s + r.netCents, 0);

  return {
    rows,
    summary: [
      { label: 'Gross collected', value: formatUsdFromCents(totalGross) },
      { label: 'Processing fees', value: formatUsdFromCents(totalFees) },
      { label: 'Net collected', value: formatUsdFromCents(totalNet) },
      { label: 'Customers', value: String(rows.length) },
    ],
  };
}
