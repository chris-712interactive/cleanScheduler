import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface RevenueByCustomerRow {
  customerId: string;
  customerName: string;
  paymentCount: number;
  netCents: number;
}

export interface RevenueByCustomerResult {
  rows: RevenueByCustomerRow[];
  summary: ReportSummaryLine[];
}

export async function runRevenueByCustomerReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<RevenueByCustomerResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      `
      amount_cents,
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
    .eq('tenant_id', tenantId);

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { rows: [], summary: [{ label: 'Net revenue', value: '$0.00' }] };
  }

  const map = new Map<string, { name: string; net: number; count: number }>();

  for (const row of data) {
    const invoice = row.tenant_invoices;
    if (!invoice?.customer_id) continue;

    const customerId = invoice.customer_id;
    const ident = invoice.customers?.customer_identities ?? null;
    const name = customerLabelFromIdentity(ident);
    const prev = map.get(customerId) ?? { name, net: 0, count: 0 };
    if (row.amount_cents > 0) prev.count += 1;
    prev.net += row.amount_cents;
    map.set(customerId, prev);
  }

  const rows: RevenueByCustomerRow[] = [...map.entries()]
    .map(([customerId, v]) => ({
      customerId,
      customerName: v.name,
      paymentCount: v.count,
      netCents: v.net,
    }))
    .filter((r) => r.netCents !== 0)
    .sort((a, b) => b.netCents - a.netCents);

  const totalNet = rows.reduce((s, r) => s + r.netCents, 0);

  return {
    rows,
    summary: [
      { label: 'Net revenue', value: formatUsdFromCents(totalNet) },
      { label: 'Customers', value: String(rows.length) },
      {
        label: 'Top customer share',
        value:
          rows.length > 0 && totalNet > 0
            ? `${Math.round((rows[0]!.netCents / totalNet) * 100)}%`
            : '—',
      },
    ],
  };
}
