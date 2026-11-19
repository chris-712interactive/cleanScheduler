import { describe, expect, it } from 'vitest';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  EntitlementGateError,
  featureUpgradeMessage,
  isFeatureEnabled,
  limitUpgradeMessage,
  PLATFORM_TIER_ENTITLEMENTS,
  TRIAL_ENTITLEMENTS,
} from '@/lib/billing/entitlements';

describe('entitlements', () => {
  it('enables SMS only on Pro and applicant texts on Business and Pro', () => {
    expect(isFeatureEnabled('starter', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('business', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('pro', 'smsCommunication')).toBe(true);
    expect(isFeatureEnabled('starter', 'applicantSms')).toBe(false);
    expect(isFeatureEnabled('trial', 'applicantSms')).toBe(false);
    expect(isFeatureEnabled('business', 'applicantSms')).toBe(true);
    expect(isFeatureEnabled('pro', 'applicantSms')).toBe(true);
    expect(PLATFORM_TIER_ENTITLEMENTS.business.limits.includedApplicantSmsCreditsMonthly).toBe(100);
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.monthlyPriceUsd).toBe(39);
    expect(PLATFORM_TIER_ENTITLEMENTS.business.monthlyPriceUsd).toBe(129);
    expect(PLATFORM_TIER_ENTITLEMENTS.pro.monthlyPriceUsd).toBe(299);
  });

  it('enables GPS check-in on all plans including Starter', () => {
    expect(isFeatureEnabled('starter', 'gpsVerifiedCheckIn')).toBe(true);
    expect(isFeatureEnabled('business', 'gpsVerifiedCheckIn')).toBe(true);
    expect(isFeatureEnabled('pro', 'gpsVerifiedCheckIn')).toBe(true);
    expect(isFeatureEnabled('trial', 'gpsVerifiedCheckIn')).toBe(true);
  });

  it('enables Starter email reminders and booking request, keeps SMS on Pro', () => {
    expect(isFeatureEnabled('starter', 'invoiceReminderEmail')).toBe(true);
    expect(isFeatureEnabled('starter', 'emailVisitReminders')).toBe(true);
    expect(isFeatureEnabled('starter', 'publicBookingRequest')).toBe(true);
    expect(isFeatureEnabled('starter', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('pro', 'smsCommunication')).toBe(true);
  });

  it('enables proof photos, on-my-way, and review-request emails on Starter', () => {
    expect(isFeatureEnabled('starter', 'proofOfServicePhotos')).toBe(true);
    expect(isFeatureEnabled('starter', 'emailOnMyWay')).toBe(true);
    expect(isFeatureEnabled('starter', 'emailReviewRequest')).toBe(true);
    expect(isFeatureEnabled('starter', 'visitChecklists')).toBe(true);
    expect(isFeatureEnabled('starter', 'proofOfServicePortalShare')).toBe(false);
    expect(isFeatureEnabled('trial', 'proofOfServicePhotos')).toBe(true);
    expect(isFeatureEnabled('trial', 'emailOnMyWay')).toBe(true);
    expect(isFeatureEnabled('trial', 'emailReviewRequest')).toBe(true);
    expect(isFeatureEnabled('trial', 'visitChecklists')).toBe(true);
  });

  it('keeps the hiring desk on Business and Pro, off Starter and the trial', () => {
    expect(isFeatureEnabled('starter', 'hiringDesk')).toBe(false);
    expect(isFeatureEnabled('trial', 'hiringDesk')).toBe(false);
    expect(isFeatureEnabled('business', 'hiringDesk')).toBe(true);
    expect(isFeatureEnabled('pro', 'hiringDesk')).toBe(true);
    expect(PLATFORM_TIER_ENTITLEMENTS.business.limits.maxActiveHiringOpenings).toBe(5);
    expect(PLATFORM_TIER_ENTITLEMENTS.pro.limits.maxActiveHiringOpenings).toBe(25);
  });

  it('exposes seat limits for starter', () => {
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.limits.includedOfficeSeats).toBe(2);
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.limits.includedFieldSeats).toBe(5);
  });

  it('keeps published prices while mapping routing to plan tiers', () => {
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.monthlyPriceUsd).toBe(39);
    expect(PLATFORM_TIER_ENTITLEMENTS.business.monthlyPriceUsd).toBe(129);
    expect(PLATFORM_TIER_ENTITLEMENTS.pro.monthlyPriceUsd).toBe(299);

    for (const plan of ['starter', 'business', 'pro', 'trial'] as const) {
      expect(isFeatureEnabled(plan, 'dayMap')).toBe(true);
      expect(isFeatureEnabled(plan, 'singleCleanerStopOrdering')).toBe(true);
    }

    expect(isFeatureEnabled('starter', 'multiCleanerDispatch')).toBe(false);
    expect(isFeatureEnabled('trial', 'multiCleanerDispatch')).toBe(false);
    expect(isFeatureEnabled('business', 'multiCleanerDispatch')).toBe(true);
    expect(isFeatureEnabled('pro', 'multiCleanerDispatch')).toBe(true);

    for (const feature of [
      'routeReoptimization',
      'multipleStartLocations',
      'driveTimeReports',
    ] as const) {
      expect(isFeatureEnabled('starter', feature)).toBe(false);
      expect(isFeatureEnabled('business', feature)).toBe(false);
      expect(isFeatureEnabled('trial', feature)).toBe(false);
      expect(isFeatureEnabled('pro', feature)).toBe(true);
    }

    expect(TRIAL_ENTITLEMENTS.features.dayMap).toBe(true);
  });

  it('tells a blocked workspace which plan includes the feature', () => {
    expect(featureUpgradeMessage('multiCleanerDispatch')).toBe(
      'This feature is included in the Business plan. Upgrade your plan to use it.',
    );
    expect(featureUpgradeMessage('driveTimeReports')).toBe(
      'This feature is included in the Pro plan. Upgrade your plan to use it.',
    );
    expect(featureUpgradeMessage('dayMap')).toBe(
      'This feature is included in the Starter plan. Upgrade your plan to use it.',
    );

    expect(() => assertFeatureEnabled('starter', 'multiCleanerDispatch')).toThrow(
      EntitlementGateError,
    );
    expect(() => assertFeatureEnabled('starter', 'multiCleanerDispatch')).toThrow(
      'This feature is included in the Business plan. Upgrade your plan to use it.',
    );
    expect(() => assertFeatureEnabled('starter', 'dayMap')).not.toThrow();
    expect(() => assertFeatureEnabled('business', 'dayMap')).not.toThrow();
    expect(() => assertFeatureEnabled('pro', 'routeReoptimization')).not.toThrow();
  });

  it('raises a limit by plan upgrade and does not mention an add-on', () => {
    const message = limitUpgradeMessage('starter', 'maxActiveCustomers', 500);
    expect(message).toBe(
      'Starter allows up to 500 for active customers. Upgrade your plan to continue.',
    );
    expect(message.toLowerCase()).not.toContain('add-on');
    expect(message.toLowerCase()).not.toContain('addon');

    expect(() => assertLimitNotExceeded('starter', 'maxActiveCustomers', 500)).toThrow(message);
    expect(() => assertLimitNotExceeded('starter', 'maxActiveCustomers', 499)).not.toThrow();
  });
});
