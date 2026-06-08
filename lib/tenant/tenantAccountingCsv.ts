import { rowsToCsv, type CsvColumn } from '@/lib/reports/toCsv';
import { formatUsdFromCents } from '@/lib/format/money';
import type { TenantAccountingSummary } from '@/lib/tenant/loadTenantAccountingSummary';

interface TenantAccountingCsvRow {
  section: string;
  metric: string;
  value: string;
}

function summaryValue(summary: { label: string; value: string }[], label: string): string {
  return summary.find((line) => line.label === label)?.value ?? '—';
}

export function tenantAccountingSummaryToCsv(summary: TenantAccountingSummary): string {
  const rows: TenantAccountingCsvRow[] = [
    {
      section: 'Outstanding AR',
      metric: 'Total outstanding',
      value: formatUsdFromCents(summary.outstandingArCents),
    },
    {
      section: 'Outstanding AR',
      metric: 'Open invoices',
      value: String(summary.outstandingInvoiceCount),
    },
    {
      section: 'Outstanding AR',
      metric: 'Overdue invoices',
      value: String(summary.outstandingPastDueCount),
    },
    {
      section: 'Last 30 days — invoices',
      metric: 'Invoices',
      value: summaryValue(summary.last30Days.invoiceSummary, 'Invoices'),
    },
    {
      section: 'Last 30 days — invoices',
      metric: 'Billed',
      value: summaryValue(summary.last30Days.invoiceSummary, 'Billed'),
    },
    {
      section: 'Last 30 days — invoices',
      metric: 'Paid',
      value: summaryValue(summary.last30Days.invoiceSummary, 'Paid'),
    },
    {
      section: 'Last 30 days — invoices',
      metric: 'Outstanding',
      value: summaryValue(summary.last30Days.invoiceSummary, 'Outstanding'),
    },
    {
      section: 'Last 30 days — payments',
      metric: 'Net collected',
      value: summaryValue(summary.last30Days.paymentSummary, 'Net collected'),
    },
    {
      section: 'Last 30 days — payments',
      metric: 'Refunds',
      value: summaryValue(summary.last30Days.paymentSummary, 'Refunds'),
    },
    {
      section: 'Last 90 days — invoices',
      metric: 'Invoices',
      value: summaryValue(summary.last90Days.invoiceSummary, 'Invoices'),
    },
    {
      section: 'Last 90 days — invoices',
      metric: 'Billed',
      value: summaryValue(summary.last90Days.invoiceSummary, 'Billed'),
    },
    {
      section: 'Last 90 days — invoices',
      metric: 'Paid',
      value: summaryValue(summary.last90Days.invoiceSummary, 'Paid'),
    },
    {
      section: 'Last 90 days — invoices',
      metric: 'Outstanding',
      value: summaryValue(summary.last90Days.invoiceSummary, 'Outstanding'),
    },
    {
      section: 'Last 90 days — payments',
      metric: 'Net collected',
      value: summaryValue(summary.last90Days.paymentSummary, 'Net collected'),
    },
    {
      section: 'Last 90 days — payments',
      metric: 'Refunds',
      value: summaryValue(summary.last90Days.paymentSummary, 'Refunds'),
    },
  ];

  const columns: CsvColumn<TenantAccountingCsvRow>[] = [
    { key: 'section', header: 'Section', format: (r) => r.section },
    { key: 'metric', header: 'Metric', format: (r) => r.metric },
    { key: 'value', header: 'Value', format: (r) => r.value },
  ];

  return rowsToCsv(columns, rows);
}
