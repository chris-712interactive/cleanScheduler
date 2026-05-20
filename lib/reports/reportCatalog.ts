import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import type { ReportGate, ReportSection, ReportSlug } from '@/lib/reports/types';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  LineChart,
  Percent,
  PieChart,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

export interface ReportCatalogEntry {
  slug: ReportSlug;
  title: string;
  description: string;
  section: ReportSection;
  sectionLabel: string;
  icon: LucideIcon;
  phase: 1 | 15 | 2 | 3;
  gate: ReportGate;
  minimumTierLabel?: string;
  usesDateRange: boolean;
  dateRangeHint?: string;
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    slug: 'outstanding-balances',
    title: 'Outstanding balances',
    description: 'Open invoices by customer with AR aging buckets.',
    section: 'financial',
    sectionLabel: 'Financial close',
    icon: Wallet,
    phase: 1,
    gate: { kind: 'none' },
    usesDateRange: false,
    dateRangeHint: 'Snapshot as of the “To” date (or today).',
  },
  {
    slug: 'invoice-audit',
    title: 'Invoice audit',
    description: 'Invoices created in the period with status, balances, and payment methods.',
    section: 'financial',
    sectionLabel: 'Financial close',
    icon: ClipboardList,
    phase: 1,
    gate: { kind: 'none' },
    usesDateRange: true,
  },
  {
    slug: 'collections-summary',
    title: 'Collections summary',
    description: 'Cash collected in the period by payment method, including refunds.',
    section: 'financial',
    sectionLabel: 'Financial close',
    icon: Receipt,
    phase: 1,
    gate: { kind: 'none' },
    usesDateRange: true,
  },
  {
    slug: 'field-check-tracking',
    title: 'Field check tracking',
    description: 'Check payments and audit stages — manage deposits in Payment audits.',
    section: 'financial',
    sectionLabel: 'Financial close',
    icon: FileSpreadsheet,
    phase: 1,
    gate: { kind: 'none' },
    usesDateRange: true,
  },
  {
    slug: 'quote-pipeline',
    title: 'Quote pipeline',
    description: 'Quotes by status and total value in the period.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: TrendingUp,
    phase: 1,
    gate: { kind: 'none' },
    usesDateRange: true,
  },
  {
    slug: 'payment-reconciliation',
    title: 'Payment reconciliation',
    description: 'Payments grouped by method with card fee and net totals.',
    section: 'financial',
    sectionLabel: 'Financial close',
    icon: BarChart3,
    phase: 15,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'revenue-by-customer',
    title: 'Revenue by customer',
    description: 'Top customers by cash collected in the period.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: Users,
    phase: 15,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'revenue-by-service',
    title: 'Revenue by service',
    description: 'Accepted quote value grouped by service line label.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: PieChart,
    phase: 15,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'recurring-revenue',
    title: 'Recurring revenue (MRR)',
    description: 'Active customer subscriptions normalized to monthly recurring revenue.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: LineChart,
    phase: 15,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: false,
  },
  {
    slug: 'employee-performance',
    title: 'Employee performance',
    description: 'Completed jobs and scheduled hours per team member.',
    section: 'payroll',
    sectionLabel: 'Payroll & labor',
    icon: Users,
    phase: 15,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'sales-tax-summary',
    title: 'Sales tax by jurisdiction',
    description: 'Estimated tax from accepted quotes grouped by service property state/ZIP.',
    section: 'payroll',
    sectionLabel: 'Payroll & labor',
    icon: Percent,
    phase: 2,
    gate: { kind: 'feature', feature: 'salesTaxSummary' },
    minimumTierLabel: 'Business',
    usesDateRange: true,
  },
  {
    slug: 'payroll-export',
    title: 'Payroll export',
    description:
      'Hours and job counts per team member. Export CSV for generic, ADP, Gusto, or QuickBooks column layouts.',
    section: 'payroll',
    sectionLabel: 'Payroll & labor',
    icon: ClipboardList,
    phase: 2,
    gate: { kind: 'feature', feature: 'payrollExports' },
    minimumTierLabel: 'Business',
    usesDateRange: true,
  },
  {
    slug: 'crew-utilization',
    title: 'Crew utilization',
    description: 'Scheduled hours vs default weekly capacity per team member.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: BarChart3,
    phase: 2,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'on-time-arrival',
    title: 'On-time arrival',
    description: 'Check-in time vs scheduled start with a 15-minute grace window.',
    section: 'operations',
    sectionLabel: 'Operations',
    icon: Clock,
    phase: 2,
    gate: { kind: 'feature', feature: 'advancedAnalytics' },
    minimumTierLabel: 'Pro',
    usesDateRange: true,
  },
  {
    slug: 'tips-commissions',
    title: 'Tips & commissions',
    description: 'Active compensation rules configured for your workspace.',
    section: 'payroll',
    sectionLabel: 'Payroll & labor',
    icon: Receipt,
    phase: 2,
    gate: { kind: 'feature', feature: 'jobCosting' },
    minimumTierLabel: 'Business',
    usesDateRange: false,
  },
];

export const REPORT_CATALOG_BY_SLUG = Object.fromEntries(
  REPORT_CATALOG.map((entry) => [entry.slug, entry]),
) as Record<ReportSlug, ReportCatalogEntry>;

export function isReportSlug(value: string): value is ReportSlug {
  return value in REPORT_CATALOG_BY_SLUG;
}

export function isReportEnabled(tier: PlatformPlanTier, slug: ReportSlug): boolean {
  const entry = REPORT_CATALOG_BY_SLUG[slug];
  if (entry.gate.kind === 'none') return true;
  return isFeatureEnabled(tier, entry.gate.feature);
}

export function reportsBySection(): { section: ReportSection; label: string; items: ReportCatalogEntry[] }[] {
  const order: ReportSection[] = ['financial', 'operations', 'payroll'];
  const labels: Record<ReportSection, string> = {
    financial: 'Financial close',
    operations: 'Operations',
    payroll: 'Payroll & labor',
  };
  return order.map((section) => ({
    section,
    label: labels[section],
    items: REPORT_CATALOG.filter((r) => r.section === section),
  }));
}
