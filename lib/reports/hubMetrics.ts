import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getTenantOutstandingInvoicesSummary } from '@/lib/billing/outstandingInvoices';
import { manualPaymentAuditStage } from '@/lib/billing/manualPaymentAudit';
import { formatUsdFromCents } from '@/lib/format/money';

export interface ReportsHubMetrics {
  outstandingTotal: string;
  outstandingBadge: string;
  collected7d: string;
  openChecks: string;
}

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export async function getReportsHubMetrics(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<ReportsHubMetrics> {
  const fromIso = sevenDaysAgoIso();

  const [ar, paymentsRes, checksRes] = await Promise.all([
    getTenantOutstandingInvoicesSummary(db, tenantId),
    db
      .from('tenant_invoice_payments')
      .select('amount_cents')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', fromIso),
    db
      .from('tenant_invoice_payments')
      .select('received_at, deposited_at')
      .eq('tenant_id', tenantId)
      .eq('method', 'check')
      .eq('recorded_via', 'manual')
      .gte('recorded_at', fromIso),
  ]);

  let collectedCents = 0;
  for (const row of paymentsRes.data ?? []) {
    if (row.amount_cents > 0) collectedCents += row.amount_cents;
  }

  let openChecks = 0;
  for (const row of checksRes.data ?? []) {
    if (manualPaymentAuditStage(row) !== 'complete') openChecks += 1;
  }

  const overduePart =
    ar.pastDueCount > 0 ? `${ar.pastDueCount} overdue` : `${ar.invoiceCount} with balance`;

  return {
    outstandingTotal: formatUsdFromCents(ar.totalCents),
    outstandingBadge: overduePart,
    collected7d: formatUsdFromCents(collectedCents),
    openChecks: String(openChecks),
  };
}
