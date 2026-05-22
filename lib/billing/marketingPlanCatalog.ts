import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { formatOfficeFieldSeatLine } from '@/lib/billing/teamSeats';

/** Curated feature bullets for marketing surfaces (pricing page, trial signup, homepage). */
export function getMarketingFeatureBullets(tier: PlatformPlanTier): string[] {
  const limits = PLATFORM_TIER_ENTITLEMENTS[tier].limits;
  const features = PLATFORM_TIER_ENTITLEMENTS[tier].features;

  const bullets: string[] = [
    'Quotes, customers, schedule & recurring visits',
    'Invoices, manual payments & Stripe Connect (cards/ACH)',
    formatOfficeFieldSeatLine(limits),
    `Up to ${limits.maxActiveCustomers.toLocaleString()} active customers`,
    'Core financial reports & month-end close checklist',
  ];

  if (features.customerPortal) {
    bullets.push('Branded customer portal');
  }
  if (features.rolePermissions) {
    bullets.push('Role-based permissions');
  }
  if (features.campaigns) {
    bullets.push('Email marketing campaigns');
  }
  if (features.payrollExports) {
    bullets.push('Payroll export (ADP, Gusto, QuickBooks)');
  }
  if (features.plaidReconciliation) {
    bullets.push('Bank deposit reconciliation (Zelle/ACH matching)');
  }
  if (features.salesTaxSummary) {
    bullets.push('Sales tax summary report');
  }
  if (features.jobCosting) {
    bullets.push('Tips & commissions tracking');
  }
  if (features.advancedAnalytics) {
    bullets.push('Advanced analytics (revenue, MRR, crew performance)');
  }
  if (features.forecasting) {
    bullets.push('Cohort / LTV / churn forecasting');
  }
  if (features.fullApiWebhooks) {
    bullets.push('Full API & webhooks');
  }
  if (features.dedicatedOnboarding) {
    bullets.push('Dedicated onboarding support');
  }
  if (features.smsCommunication) {
    bullets.push('SMS customer communication (visit reminders, review requests)');
  }

  return bullets;
}

export const MARKETING_PLAN_ORDER: PlatformPlanTier[] = ['starter', 'business', 'pro'];

export const MARKETING_MOST_POPULAR_TIER: PlatformPlanTier = 'business';
