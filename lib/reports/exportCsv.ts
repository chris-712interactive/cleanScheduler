import type { ReportRunResult } from '@/lib/reports/runReport';
import { fieldCheckStageLabel } from '@/lib/reports/fieldCheckReport';
import { bankDepositMatchStatusLabel } from '@/lib/reports/bankReconciliationReport';
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
        { key: 'invoiceLink', header: 'Invoice link', format: (r) => r.invoiceHref },
        { key: 'auditLink', header: 'Payment audits link', format: (r) => r.paymentAuditHref },
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
        { key: 'chain', header: 'Chain of custody', format: (r) => r.chainOfCustody },
        { key: 'invoiceLink', header: 'Invoice link', format: (r) => r.invoiceHref },
        { key: 'auditLink', header: 'Payment audits link', format: (r) => r.paymentAuditHref },
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
      const payoutCols: CsvColumn<(typeof result.data.byPayout)[0]>[] = [
        {
          key: 'arrival',
          header: 'Arrival date',
          format: (r) => (r.arrivalDate ? formatDate(r.arrivalDate) : ''),
        },
        { key: 'payout', header: 'Stripe payout id', format: (r) => r.stripePayoutId },
        { key: 'status', header: 'Status', format: (r) => r.status ?? '' },
        { key: 'count', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'fee', header: 'Fees', format: (r) => formatUsdFromCents(r.feeCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      const methodCols: CsvColumn<(typeof result.data.byMethod)[0]>[] = [
        { key: 'method', header: 'Method', format: (r) => r.method },
        { key: 'count', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'fee', header: 'Fees', format: (r) => formatUsdFromCents(r.feeCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      const payoutCsv = rowsToCsv(payoutCols, result.data.byPayout);
      const methodCsv = rowsToCsv(methodCols, result.data.byMethod);
      if (result.data.byPayout.length === 0) return methodCsv;
      return `# Card deposits by payout\n${payoutCsv}\n\n# All methods\n${methodCsv}`;
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
        {
          key: 'commission',
          header: 'Commission (est.)',
          format: (r) => formatUsdFromCents(r.commissionCents),
        },
        { key: 'flat', header: 'Flat (est.)', format: (r) => formatUsdFromCents(r.flatCents) },
        {
          key: 'variable',
          header: 'Variable pay (est.)',
          format: (r) => formatUsdFromCents(r.estimatedVariablePayCents),
        },
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
      const payoutCols: CsvColumn<(typeof result.data.payoutRows)[0]>[] = [
        { key: 'name', header: 'Team member', format: (r) => r.employeeName },
        { key: 'jobs', header: 'Jobs', format: (r) => String(r.jobsCompleted) },
        {
          key: 'commission',
          header: 'Commission (est.)',
          format: (r) => formatUsdFromCents(r.commissionCents),
        },
        { key: 'flat', header: 'Flat (est.)', format: (r) => formatUsdFromCents(r.flatCents) },
        {
          key: 'tips',
          header: 'Tip split (est.)',
          format: (r) => formatUsdFromCents(r.tipSplitCents),
        },
        {
          key: 'total',
          header: 'Total (est.)',
          format: (r) => formatUsdFromCents(r.estimatedPayCents),
        },
      ];
      return rowsToCsv(payoutCols, result.data.payoutRows);
    }
    case 'processing-fees-deductible': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'month', header: 'Month', format: (r) => r.periodMonth },
        { key: 'method', header: 'Method', format: (r) => r.method },
        { key: 'count', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'fee', header: 'Fees', format: (r) => formatUsdFromCents(r.feeCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'year-end-revenue': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'payments', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'gross', header: 'Gross', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'fee', header: 'Fees', format: (r) => formatUsdFromCents(r.feeCents) },
        { key: 'net', header: 'Net', format: (r) => formatUsdFromCents(r.netCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'customer-1099-prep': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'customer', header: 'Customer', format: (r) => r.customerName },
        { key: 'gross', header: 'Gross collected', format: (r) => formatUsdFromCents(r.grossCents) },
        { key: 'payments', header: 'Payments', format: (r) => String(r.paymentCount) },
        { key: 'flag', header: 'Meets $600 threshold', format: (r) => (r.meetsThreshold ? 'Yes' : 'No') },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'cohort-ltv-churn': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'cohort', header: 'Cohort month', format: (r) => r.cohortMonth },
        { key: 'size', header: 'Cohort size', format: (r) => String(r.customersInCohort) },
        { key: 'offset', header: 'Months since first', format: (r) => String(r.monthsSinceFirst) },
        { key: 'active', header: 'Active customers', format: (r) => String(r.activeCustomers) },
        { key: 'ret', header: 'Retention %', format: (r) => String(r.retentionPercent) },
        { key: 'rev', header: 'Revenue', format: (r) => formatUsdFromCents(r.revenueCents) },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    case 'bank-reconciliation': {
      const cols: CsvColumn<(typeof result.data.rows)[0]>[] = [
        { key: 'date', header: 'Posted', format: (r) => formatDate(r.postedDate) },
        { key: 'name', header: 'Description', format: (r) => r.name },
        { key: 'amount', header: 'Amount', format: (r) => formatUsdFromCents(r.amountCents) },
        {
          key: 'status',
          header: 'Match status',
          format: (r) => bankDepositMatchStatusLabel(r.matchStatus),
        },
        { key: 'invoice', header: 'Matched invoice', format: (r) => r.invoiceTitle ?? '' },
        { key: 'customer', header: 'Customer', format: (r) => r.customerName ?? '' },
        { key: 'suggestions', header: 'Open suggestions', format: (r) => String(r.openSuggestions) },
        { key: 'bankLink', header: 'Bank connection link', format: (r) => r.bankConnectionHref },
        { key: 'invoiceLink', header: 'Invoice link', format: (r) => r.invoiceHref ?? '' },
      ];
      return rowsToCsv(cols, result.data.rows);
    }
    default:
      return null;
  }
}
