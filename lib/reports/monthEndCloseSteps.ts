import type { ReportSlug } from '@/lib/reports/types';

export interface MonthEndCloseStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  /** Report slug when href is a dated report (uses last-month preset on close page). */
  reportSlug?: ReportSlug;
  /** Non-report operational step (billing hub, audits, bank). */
  kind: 'report' | 'billing';
}

/** Ordered month-end workflow for accountants — links use last-month preset where applicable. */
export const MONTH_END_CLOSE_STEPS: MonthEndCloseStep[] = [
  {
    id: 'outstanding',
    title: 'Review outstanding balances',
    detail: 'Snapshot open AR and aging before closing the period.',
    href: '/reports/outstanding-balances',
    reportSlug: 'outstanding-balances',
    kind: 'report',
  },
  {
    id: 'collections',
    title: 'Reconcile collections',
    detail: 'Compare cash collected in the period by payment method.',
    href: '/reports/collections-summary',
    reportSlug: 'collections-summary',
    kind: 'report',
  },
  {
    id: 'payments',
    title: 'Review customer payments ledger',
    detail: 'Scan all payments recorded on invoices for the period.',
    href: '/billing/transactions',
    kind: 'billing',
  },
  {
    id: 'audits',
    title: 'Clear payment audit queue',
    detail: 'Mark checks and cash received and deposited.',
    href: '/billing/payment-audits?filter=awaiting_deposit',
    kind: 'billing',
  },
  {
    id: 'bank',
    title: 'Match bank deposits',
    detail: 'Confirm Plaid suggestions or manually match Zelle/ACH deposits.',
    href: '/reports/bank-reconciliation',
    reportSlug: 'bank-reconciliation',
    kind: 'report',
  },
  {
    id: 'checks',
    title: 'Field check tracking',
    detail: 'Export check stages for the period; tie back to payment audits.',
    href: '/reports/field-check-tracking',
    reportSlug: 'field-check-tracking',
    kind: 'report',
  },
  {
    id: 'invoice-audit',
    title: 'Invoice audit',
    detail: 'Verify invoices created in the period and remaining balances.',
    href: '/reports/invoice-audit',
    reportSlug: 'invoice-audit',
    kind: 'report',
  },
  {
    id: 'reconciliation',
    title: 'Payment reconciliation',
    detail: 'Card payouts vs offline methods — confirm Stripe batches landed.',
    href: '/reports/payment-reconciliation',
    reportSlug: 'payment-reconciliation',
    kind: 'report',
  },
];
