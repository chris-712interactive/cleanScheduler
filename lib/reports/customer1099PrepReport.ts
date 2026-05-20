import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { IRS_1099_THRESHOLD_CENTS } from '@/lib/reports/compensationPayout';
import { runYearEndRevenueReport } from '@/lib/reports/yearEndRevenueReport';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export interface Customer1099PrepRow {
  customerId: string;
  customerName: string;
  grossCents: number;
  paymentCount: number;
  meetsThreshold: boolean;
}

export interface Customer1099PrepResult {
  rows: Customer1099PrepRow[];
  summary: ReportSummaryLine[];
}

export async function runCustomer1099PrepReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<Customer1099PrepResult> {
  const base = await runYearEndRevenueReport(db, tenantId, fromIso, toIso);

  const rows: Customer1099PrepRow[] = base.rows.map((r) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    grossCents: r.grossCents,
    paymentCount: r.paymentCount,
    meetsThreshold: r.grossCents >= IRS_1099_THRESHOLD_CENTS,
  }));

  const flagged = rows.filter((r) => r.meetsThreshold).length;

  return {
    rows,
    summary: [
      {
        label: 'Threshold',
        value: formatUsdFromCents(IRS_1099_THRESHOLD_CENTS),
      },
      { label: 'Customers flagged', value: String(flagged) },
      { label: 'Total customers', value: String(rows.length) },
      {
        label: 'Note',
        value: 'Flags gross collected per customer — confirm with your accountant which forms apply.',
      },
    ],
  };
}
