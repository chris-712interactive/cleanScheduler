import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { PLATFORM_TIER_ENTITLEMENTS, type EntitlementFeature } from '@/lib/billing/entitlements';
import { formatOfficeFieldSeatLine } from '@/lib/billing/teamSeats';

/** Pricing comparison rows for routing. Values come from the entitlement flags. */
export const ROUTING_COMPARISON_ROWS: ReadonlyArray<{
  label: string;
  feature: EntitlementFeature;
}> = [
  { label: 'Day map', feature: 'dayMap' },
  { label: 'Single-cleaner stop ordering', feature: 'singleCleanerStopOrdering' },
  { label: 'Multi-cleaner dispatch', feature: 'multiCleanerDispatch' },
  { label: 'Route re-optimization', feature: 'routeReoptimization' },
  { label: 'Multiple start locations', feature: 'multipleStartLocations' },
  { label: 'Drive-time reports', feature: 'driveTimeReports' },
];

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
    bullets.push('Applicant texts use the monthly SMS allowance');
  } else if (features.applicantSms) {
    bullets.push(
      `Text job applicants (${limits.includedApplicantSmsCreditsMonthly.toLocaleString()} SMS segments each month)`,
    );
  }
  if (features.smsCommunication || features.applicantSms) {
    bullets.push('Text packs after the monthly allowance: 1,000 for $15 or 2,500 for $35');
  }
  if (features.whiteLabelCustomerPortal) {
    bullets.push('White-label customer portal (custom domain)');
  }
  if (features.tenantMarketingSite) {
    bullets.push('Marketing website CMS with SEO pages');
  }
  if (features.tenantMarketingSiteCustomDomain) {
    bullets.push('Unified custom domain (website + portal)');
  }
  if (features.proofOfServicePhotos) {
    bullets.push('Proof-of-service photos on completed visits');
  }
  if (features.gpsVerifiedCheckIn) {
    bullets.push('GPS-verified check-in (arrival location proof)');
  }
  if (features.dayMap) {
    bullets.push('Day map of scheduled stops');
  }
  if (features.singleCleanerStopOrdering) {
    bullets.push('Single-cleaner stop ordering');
  }
  if (features.multiCleanerDispatch) {
    bullets.push('Multi-cleaner dispatch');
  }
  if (features.routeReoptimization) {
    bullets.push('Route re-optimization');
  }
  if (features.multipleStartLocations) {
    bullets.push('Multiple start locations');
  }
  if (features.driveTimeReports) {
    bullets.push('Drive-time reports');
  }
  if (features.invoiceReminderEmail) {
    bullets.push('Email visit & overdue invoice reminders');
  }
  if (features.emailOnMyWay) {
    bullets.push('On-my-way email when crew checks in');
  }
  if (features.emailReviewRequest) {
    bullets.push('Post-visit review request emails');
  }
  if (features.publicBookingRequest) {
    bullets.push('Public quote / booking request form');
  }
  if (features.hiringDesk) {
    bullets.push('Hiring desk for interview slots and show-ups');
  }
  if (features.visitChecklists) {
    bullets.push('Visit checklists for field crews');
  }
  if (features.proofOfServicePortalShare) {
    bullets.push('Proof photos shared with customers in portal');
  }

  return bullets;
}

export const MARKETING_PLAN_ORDER: PlatformPlanTier[] = ['starter', 'business', 'pro'];

export const MARKETING_MOST_POPULAR_TIER: PlatformPlanTier = 'business';
