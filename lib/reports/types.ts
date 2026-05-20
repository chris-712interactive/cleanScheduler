import type { EntitlementFeature } from '@/lib/billing/entitlements';

export type ReportSlug =
  | 'outstanding-balances'
  | 'invoice-audit'
  | 'field-check-tracking'
  | 'collections-summary'
  | 'quote-pipeline'
  | 'payment-reconciliation'
  | 'revenue-by-customer'
  | 'revenue-by-service'
  | 'recurring-revenue'
  | 'employee-performance'
  | 'sales-tax-summary'
  | 'payroll-export'
  | 'crew-utilization'
  | 'on-time-arrival'
  | 'tips-commissions';

export type ReportSection = 'financial' | 'operations' | 'payroll';

export type ReportGate =
  | { kind: 'none' }
  | { kind: 'feature'; feature: EntitlementFeature };

export type AgingBucket = 'current' | 'days_31_60' | 'days_61_90' | 'days_90_plus' | 'no_due_date';

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  current: '0–30 days',
  days_31_60: '31–60 days',
  days_61_90: '61–90 days',
  days_90_plus: '90+ days',
  no_due_date: 'No due date',
};

export interface ReportDateRange {
  fromInput: string;
  toInput: string;
  fromIso: string | null;
  toIso: string | null;
}

export interface ReportSummaryLine {
  label: string;
  value: string;
}
