import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { runCollectionsSummaryReport } from '@/lib/reports/collectionsSummaryReport';
import { runEmployeePerformanceReport } from '@/lib/reports/employeePerformanceReport';
import { runFieldCheckReport } from '@/lib/reports/fieldCheckReport';
import { runInvoiceAuditReport } from '@/lib/reports/invoiceAuditReport';
import { runOutstandingBalancesReport } from '@/lib/reports/outstandingBalancesReport';
import { runPaymentReconciliationReport } from '@/lib/reports/paymentReconciliationReport';
import { runQuotePipelineReport } from '@/lib/reports/quotePipelineReport';
import { runRecurringRevenueReport } from '@/lib/reports/recurringRevenueReport';
import { runRevenueByCustomerReport } from '@/lib/reports/revenueByCustomerReport';
import { runRevenueByServiceReport } from '@/lib/reports/revenueByServiceReport';
import { runSalesTaxSummaryReport } from '@/lib/reports/salesTaxSummaryReport';
import { runPayrollExportReport } from '@/lib/reports/payrollExportReport';
import { runCrewUtilizationReport } from '@/lib/reports/crewUtilizationReport';
import { runOnTimeArrivalReport } from '@/lib/reports/onTimeArrivalReport';
import { runTipsCommissionsReport } from '@/lib/reports/tipsCommissionsReport';
import { runProcessingFeesReport } from '@/lib/reports/processingFeesReport';
import { runYearEndRevenueReport } from '@/lib/reports/yearEndRevenueReport';
import { runCustomer1099PrepReport } from '@/lib/reports/customer1099PrepReport';
import { runCohortLtvReport } from '@/lib/reports/cohortLtvReport';
import type { ReportSlug } from '@/lib/reports/types';

export type ReportRunResult =
  | { kind: 'outstanding-balances'; data: Awaited<ReturnType<typeof runOutstandingBalancesReport>> }
  | { kind: 'invoice-audit'; data: Awaited<ReturnType<typeof runInvoiceAuditReport>> }
  | { kind: 'field-check-tracking'; data: Awaited<ReturnType<typeof runFieldCheckReport>> }
  | { kind: 'collections-summary'; data: Awaited<ReturnType<typeof runCollectionsSummaryReport>> }
  | { kind: 'quote-pipeline'; data: Awaited<ReturnType<typeof runQuotePipelineReport>> }
  | {
      kind: 'payment-reconciliation';
      data: Awaited<ReturnType<typeof runPaymentReconciliationReport>>;
    }
  | { kind: 'revenue-by-customer'; data: Awaited<ReturnType<typeof runRevenueByCustomerReport>> }
  | { kind: 'revenue-by-service'; data: Awaited<ReturnType<typeof runRevenueByServiceReport>> }
  | { kind: 'recurring-revenue'; data: Awaited<ReturnType<typeof runRecurringRevenueReport>> }
  | { kind: 'employee-performance'; data: Awaited<ReturnType<typeof runEmployeePerformanceReport>> }
  | { kind: 'sales-tax-summary'; data: Awaited<ReturnType<typeof runSalesTaxSummaryReport>> }
  | { kind: 'payroll-export'; data: Awaited<ReturnType<typeof runPayrollExportReport>> }
  | { kind: 'crew-utilization'; data: Awaited<ReturnType<typeof runCrewUtilizationReport>> }
  | { kind: 'on-time-arrival'; data: Awaited<ReturnType<typeof runOnTimeArrivalReport>> }
  | { kind: 'tips-commissions'; data: Awaited<ReturnType<typeof runTipsCommissionsReport>> }
  | { kind: 'processing-fees-deductible'; data: Awaited<ReturnType<typeof runProcessingFeesReport>> }
  | { kind: 'year-end-revenue'; data: Awaited<ReturnType<typeof runYearEndRevenueReport>> }
  | { kind: 'customer-1099-prep'; data: Awaited<ReturnType<typeof runCustomer1099PrepReport>> }
  | { kind: 'cohort-ltv-churn'; data: Awaited<ReturnType<typeof runCohortLtvReport>> }
  | { kind: 'pro-placeholder' };

const IMPLEMENTED_REPORT_SLUGS: ReportSlug[] = [
  'outstanding-balances',
  'invoice-audit',
  'field-check-tracking',
  'collections-summary',
  'quote-pipeline',
  'payment-reconciliation',
  'revenue-by-customer',
  'revenue-by-service',
  'recurring-revenue',
  'employee-performance',
  'sales-tax-summary',
  'payroll-export',
  'crew-utilization',
  'on-time-arrival',
  'tips-commissions',
  'processing-fees-deductible',
  'year-end-revenue',
  'customer-1099-prep',
  'cohort-ltv-churn',
];

export function isImplementedReportSlug(slug: ReportSlug): boolean {
  return IMPLEMENTED_REPORT_SLUGS.includes(slug);
}

/** @deprecated Use isImplementedReportSlug */
export function isPhase1ReportSlug(slug: ReportSlug): boolean {
  return (
    slug === 'outstanding-balances' ||
    slug === 'invoice-audit' ||
    slug === 'field-check-tracking' ||
    slug === 'collections-summary' ||
    slug === 'quote-pipeline'
  );
}

export async function runTenantReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  slug: ReportSlug,
  params: { fromIso: string | null; toIso: string | null },
): Promise<ReportRunResult> {
  switch (slug) {
    case 'outstanding-balances':
      return {
        kind: 'outstanding-balances',
        data: await runOutstandingBalancesReport(db, tenantId, params.toIso),
      };
    case 'invoice-audit':
      return {
        kind: 'invoice-audit',
        data: await runInvoiceAuditReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'field-check-tracking':
      return {
        kind: 'field-check-tracking',
        data: await runFieldCheckReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'collections-summary':
      return {
        kind: 'collections-summary',
        data: await runCollectionsSummaryReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'quote-pipeline':
      return {
        kind: 'quote-pipeline',
        data: await runQuotePipelineReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'payment-reconciliation':
      return {
        kind: 'payment-reconciliation',
        data: await runPaymentReconciliationReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'revenue-by-customer':
      return {
        kind: 'revenue-by-customer',
        data: await runRevenueByCustomerReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'revenue-by-service':
      return {
        kind: 'revenue-by-service',
        data: await runRevenueByServiceReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'recurring-revenue':
      return {
        kind: 'recurring-revenue',
        data: await runRecurringRevenueReport(db, tenantId),
      };
    case 'employee-performance':
      return {
        kind: 'employee-performance',
        data: await runEmployeePerformanceReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'sales-tax-summary':
      return {
        kind: 'sales-tax-summary',
        data: await runSalesTaxSummaryReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'payroll-export':
      return {
        kind: 'payroll-export',
        data: await runPayrollExportReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'crew-utilization':
      return {
        kind: 'crew-utilization',
        data: await runCrewUtilizationReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'on-time-arrival':
      return {
        kind: 'on-time-arrival',
        data: await runOnTimeArrivalReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'tips-commissions':
      return {
        kind: 'tips-commissions',
        data: await runTipsCommissionsReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'processing-fees-deductible':
      return {
        kind: 'processing-fees-deductible',
        data: await runProcessingFeesReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'year-end-revenue':
      return {
        kind: 'year-end-revenue',
        data: await runYearEndRevenueReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'customer-1099-prep':
      return {
        kind: 'customer-1099-prep',
        data: await runCustomer1099PrepReport(db, tenantId, params.fromIso, params.toIso),
      };
    case 'cohort-ltv-churn':
      return {
        kind: 'cohort-ltv-churn',
        data: await runCohortLtvReport(db, tenantId, params.fromIso, params.toIso),
      };
    default:
      return { kind: 'pro-placeholder' };
  }
}
