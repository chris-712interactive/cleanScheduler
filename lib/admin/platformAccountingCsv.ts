import { rowsToCsv, type CsvColumn } from '@/lib/reports/toCsv';
import { formatUsdFromCents } from '@/lib/format/money';
import type { PlatformAccountingSummary } from '@/lib/admin/platformStats';

export function platformAccountingSummaryToCsv(summary: PlatformAccountingSummary): string {
  const summaryRows = [
    {
      tenantSlug: '—',
      tenantName: 'Platform totals',
      status: '—',
      plan: '—',
      interval: '—',
      mrr: formatUsdFromCents(summary.estimatedMrrCents),
      ytd: formatUsdFromCents(summary.estimatedRevenueYtdCents),
      stripeSubscriptionId: `${summary.activePaidSubscriptions} paying`,
    },
  ];

  const tenantRows = summary.tenantSubscriptions.map((row) => ({
    tenantSlug: row.tenantSlug,
    tenantName: row.tenantName,
    status: row.status,
    plan: row.platformPlanLabel ?? '—',
    interval: row.billingInterval ?? '—',
    mrr: formatUsdFromCents(row.monthlyRecurringCents),
    ytd: formatUsdFromCents(row.estimatedYtdCents),
    stripeSubscriptionId: row.stripeSubscriptionId ?? '',
  }));

  const columns: CsvColumn<(typeof tenantRows)[0]>[] = [
    { key: 'tenantSlug', header: 'Tenant slug', format: (r) => r.tenantSlug },
    { key: 'tenantName', header: 'Tenant name', format: (r) => r.tenantName },
    { key: 'status', header: 'Subscription status', format: (r) => r.status },
    { key: 'plan', header: 'Plan', format: (r) => r.plan },
    { key: 'interval', header: 'Billing interval', format: (r) => r.interval },
    { key: 'mrr', header: 'Est. MRR', format: (r) => r.mrr },
    { key: 'ytd', header: 'Est. revenue YTD', format: (r) => r.ytd },
    {
      key: 'stripeSubscriptionId',
      header: 'Stripe subscription',
      format: (r) => r.stripeSubscriptionId,
    },
  ];

  return rowsToCsv(columns, [...summaryRows, ...tenantRows]);
}
