import type { ReportRunResult } from '@/lib/reports/runReport';

/** Reports with a paginated detail table (not summary-only aggregates). */
export function isReportPaginated(result: ReportRunResult): boolean {
  switch (result.kind) {
    case 'outstanding-balances':
    case 'invoice-audit':
    case 'field-check-tracking':
    case 'revenue-by-customer':
    case 'revenue-by-service':
    case 'recurring-revenue':
    case 'employee-performance':
    case 'sales-tax-summary':
    case 'payroll-export':
    case 'crew-utilization':
    case 'on-time-arrival':
    case 'tips-commissions':
      return true;
    default:
      return false;
  }
}

export function countReportRows(result: ReportRunResult): number {
  switch (result.kind) {
    case 'outstanding-balances':
      return result.data.rows.length;
    case 'invoice-audit':
      return result.data.rows.length;
    case 'field-check-tracking':
      return result.data.rows.length;
    case 'collections-summary':
      return result.data.byMethod.length;
    case 'quote-pipeline':
      return result.data.byStatus.length;
    case 'payment-reconciliation':
      return result.data.byMethod.length;
    case 'revenue-by-customer':
      return result.data.rows.length;
    case 'revenue-by-service':
      return result.data.rows.length;
    case 'recurring-revenue':
      return result.data.rows.length;
    case 'employee-performance':
    case 'sales-tax-summary':
    case 'payroll-export':
    case 'crew-utilization':
    case 'on-time-arrival':
    case 'tips-commissions':
      return result.data.rows.length;
    default:
      return 0;
  }
}
