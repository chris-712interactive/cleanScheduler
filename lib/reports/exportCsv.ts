import type { ReportRunResult } from '@/lib/reports/runReport';
import { fieldCheckStageLabel } from '@/lib/reports/fieldCheckReport';
import { rowsToCsv, type CsvColumn } from '@/lib/reports/toCsv';
import { AGING_BUCKET_LABEL } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function reportResultToCsv(result: ReportRunResult): string | null {
  switch (result.kind) {
    case 'outstanding-balances': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'invoice', header: 'Invoice', format: (r) => r.invoiceTitle },
        { key: 'status', header: 'Status', format: (r) => r.status },
        { key: 'due', header: 'Due date', format: (r) => (r.dueDate ? formatDate(r.dueDate) : '') },
        { key: 'aging', header: 'Aging bucket', format: (r) => AGING_BUCKET_LABEL[r.agingBucket] },
        { key: 'days', header: 'Days outstanding', format: (r) => String(r.daysOutstanding ?? '') },
        { key: 'amount', header: 'Balance due', format: (r) => formatUsdFromCents(r.remainingCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'invoice-audit': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'title', header: 'Invoice', format: (r) => r.title },
        { key: 'status', header: 'Status', format: (r) => r.status },
        { key: 'created', header: 'Created', format: (r) => formatDate(r.createdAt) },
        { key: 'due', header: 'Due', format: (r) => (r.dueDate ? formatDate(r.dueDate) : '') },
        { key: 'total', header: 'Total', format: (r) => formatUsdFromCents(r.amountCents) },
        { key: 'paid', header: 'Paid', format: (r) => formatUsdFromCents(r.paidCents) },
        { key: 'remaining', header: 'Balance', format: (r) => formatUsdFromCents(r.remainingCents) },
        { key: 'methods', header: 'Payment methods', format: (r) => r.paymentMethods },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'field-check-tracking': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'date', header: 'Recorded', format: (r) => formatDate(r.recordedAt) },
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'invoice', header: 'Invoice', format: (r) => r.invoiceTitle },
        { key: 'check', header: 'Check reference', format: (r) => r.checkReference },
        { key: 'amount', header: 'Amount', format: (r) => formatUsdFromCents(r.amountCents) },
        { key: 'stage', header: 'Stage', format: (r) => fieldCheckStageLabel(r.stage) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'collections-summary': {
      const cols: CsvColumn<(typeof result.data.byMethod)[0]>[] = [
        { key: 'method', header: 'Method', format: (r) => r.method },
        { key: 'count', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'refund', header: 'Refunds', format: (r) => formatUsdFromCents(r.refundCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      return rowsToCsv(cols, result.data.byMethod);
    }
    case 'quote-pipeline': {
      const cols: CsvColumn<(typeof result.data.byStatus)[0]>[] = [
        { key: 'status', header: 'Status', format: (r) => r.status },
        { key: 'count', header: 'Count', format: (r) => String(r.count) },
        { key: 'total', header: 'Total value', format: (r) => formatUsdFromCents(r.totalCents) },
      ];
      return rowsToCsv(cols, result.data.byStatus);
    }
    case 'payment-reconciliation': {
      const cols: CsvColumn<(typeof result.data.byMethod)[0]>[] = [
        { key: 'method', header: 'Method', format: (r) => r.method },
        { key: 'count', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'fee', header: 'Fees', format: (r) => formatUsdFromCents(r.feeCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      return rowsToCsv(cols, result.data.byMethod);
    }
    case 'revenue-by-customer': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'payments', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'net', header: 'Net revenue', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'revenue-by-service': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'service', header: 'Service', format: (r) => r.serviceLabel },
        { key: 'lines', header: 'Line items', format: (r) => String(r.lineCount) },
        { key: 'total', header: 'Accepted value', format: (r) => formatUsdFromCents(r.totalCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'recurring-revenue': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'plan', header: 'Plan', format: (r) => r.planName },
        { key: 'status', header: 'Status', format: (r) => r.status },
        { key: 'mrr', header: 'MRR', format: (r) => formatUsdFromCents(r.monthlyCents) },
        { key: 'interval', header: 'Billing interval', format: (r) => r.billingInterval },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'employee-performance': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'name', header: 'Team member', format: (r) => r.displayName },
        { key: 'jobs', header: 'Jobs completed', format: (r) => String(r.jobsCompleted) },
        { key: 'hours', header: 'Scheduled hours', format: (r) => String(r.scheduledHours) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'sales-tax-summary': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'jurisdiction', header: 'Jurisdiction', format: (r) => r.jurisdictionKey },
        { key: 'state', header: 'State', format: (r) => r.state },
        { key: 'quotes', header: 'Quotes', format: (r) => String(r.quoteCount) },
        { key: 'taxable', header: 'Taxable amount', format: (r) => formatUsdFromCents(r.taxableCents) },
        { key: 'tax', header: 'Tax (est.)', format: (r) => formatUsdFromCents(r.taxCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'payroll-export': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'id', header: 'Employee ID', format: (r) => r.userId },
        { key: 'name', header: 'Employee name', format: (r) => r.employeeName },
        { key: 'jobs', header: 'Jobs completed', format: (r) => String(r.jobsCompleted) },
        { key: 'regular', header: 'Regular hours', format: (r) => String(r.regularHours) },
        { key: 'ot', header: 'Overtime hours', format: (r) => String(r.overtimeHours) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'crew-utilization': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'name', header: 'Team member', format: (r) => r.displayName },
        { key: 'scheduled', header: 'Scheduled hours', format: (r) => String(r.scheduledHours) },
        { key: 'capacity', header: 'Capacity hours', format: (r) => String(r.capacityHours) },
        { key: 'util', header: 'Utilization %', format: (r) => String(r.utilizationPercent) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'on-time-arrival': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'job', header: 'Job', format: (r) => r.title },
        { key: 'start', header: 'Scheduled start', format: (r) => formatDate(r.scheduledStart) },
        { key: 'checkin', header: 'Checked in', format: (r) => (r.checkedInAt ? formatDate(r.checkedInAt) : '') },
        { key: 'late', header: 'Minutes late', format: (r) => (r.minutesLate != null ? String(r.minutesLate) : '') },
        { key: 'ontime', header: 'On time', format: (r) => (r.onTime ? 'Yes' : 'No') },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'tips-commissions': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'name', header: 'Rule name', format: (r) => r.name },
        { key: 'type', header: 'Type', format: (r) => r.ruleType },
        { key: 'rate', header: 'Rate', format: (r) => r.rateLabel },
        { key: 'role', header: 'Applies to', format: (r) => r.appliesToRole },
        { key: 'active', header: 'Active', format: (r) => (r.isActive ? 'Yes' : 'No') },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    default:
      return null;
  }
}
