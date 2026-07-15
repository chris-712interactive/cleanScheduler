import { describe, expect, it } from 'vitest';
import { isFeatureEnabled, PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';

describe('entitlements', () => {
  it('enables SMS only on Pro', () => {
    expect(isFeatureEnabled('starter', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('business', 'smsCommunication')).toBe(false);
    expect(isFeatureEnabled('pro', 'smsCommunication')).toBe(true);
  });

  it('enables GPS check-in on Business and trial, not Starter', () => {
    expect(isFeatureEnabled('starter', 'gpsVerifiedCheckIn')).toBe(false);
    expect(isFeatureEnabled('business', 'gpsVerifiedCheckIn')).toBe(true);
    expect(isFeatureEnabled('pro', 'gpsVerifiedCheckIn')).toBe(true);
    expect(isFeatureEnabled('trial', 'gpsVerifiedCheckIn')).toBe(true);
  });

  it('exposes seat limits for starter', () => {
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.limits.includedOfficeSeats).toBe(1);
    expect(PLATFORM_TIER_ENTITLEMENTS.starter.limits.includedFieldSeats).toBe(3);
  });
});
