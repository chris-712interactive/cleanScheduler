import { describe, expect, it } from 'vitest';
import { isFeatureEnabled, PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';

describe('entitlements', () => {
  it('enables SMS only on Pro', () => {
    expect(isFeatureEnabled('starter', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('business', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('pro', 'smsCommunication')).toBe(true);
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
});
