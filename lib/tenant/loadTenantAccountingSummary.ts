import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { runCollectionsSummaryReport } from '@/lib/reports/collectionsSummaryReport';
import { runInvoiceAuditReport } from '@/lib/reports/invoiceAuditReport';
import { formatUsdFromCents } from '@/lib/format/money';
import type { ReportSummaryLine } from '@/lib/reports/types';

export interface TenantAccountingPeriodRollup {
  invoiceSummary: ReportSummaryLine[];
  paymentSummary: ReportSummaryLine[];
}

export interface TenantAccountingSummary {
  last30Days: TenantAccountingPeriodRollup;
  last90Days: TenantAccountingPeriodRollup;
  outstandingArCents: number;
  outstandingInvoiceCount: number;
  outstandingPastDueCount: number;
}

function periodStartIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

async function loadPeriodRollup(
  db: SupabaseClient<Database>,
  tenantId: string,
  days: number,
): Promise<TenantAccountingPeriodRollup> {
  const fromIso = periodStartIso(days);
  const [invoices, payments] = await Promise.all([
    runInvoiceAuditReport(db, tenantId, fromIso, null),
    runCollectionsSummaryReport(db, tenantId, fromIso, null),
  ]);

  return {
    invoiceSummary: invoices.summary,
    paymentSummary: payments.summary,
  };
}

export async function loadTenantAccountingSummary(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantAccountingSummary> {
  const [last30Days, last90Days, outstanding] = await Promise.all([
    loadPeriodRollup(db, tenantId, 30),
    loadPeriodRollup(db, tenantId, 90),
    getTenantOutstandingInvoicesSummary(db, tenantId),
  ]);

  return {
    last30Days,
    last90Days,
    outstandingArCents: outstanding.totalCents,
    outstandingInvoiceCount: outstanding.invoiceCount,
    outstandingPastDueCount: outstanding.pastDueCount,
  };
}

export function formatOutstandingArLabel(cents: number, pastDueCount: number): string {
  const amount = formatUsdFromCents(cents);
  if (pastDueCount > 0) {
    return `${amount} (${pastDueCount} overdue)`;
  }
  return amount;
}
