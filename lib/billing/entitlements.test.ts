import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapStripeSubscriptionStatus } from '@/lib/billing/syncTenantPlatformSubscription';
import {
  isTenantPortalSuspended,
  resolveTenantSubscriptionAccess,
} from '@/lib/billing/tenantSubscriptionAccess';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  EntitlementGateError,
  featureUpgradeMessage,
  isFeatureEnabled,
  limitUpgradeMessage,
  PLATFORM_TIER_ENTITLEMENTS,
  resolveTenantEntitlementPlan,
  ROUTING_ENTITLEMENT_FEATURES,
  routingFeaturesForPlan,
  TRIAL_ENTITLEMENTS,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';

const ROUTING_MATRIX: Record<
  EntitlementPlanKey,
  Record<(typeof ROUTING_ENTITLEMENT_FEATURES)[number], boolean>
> = {
  starter: {
    dayMap: true,
    singleCleanerStopOrdering: true,
    multiCleanerDispatch: false,
    routeReoptimization: false,
    multipleStartLocations: false,
    driveTimeReports: false,
  },
  business: {
    dayMap: true,
    singleCleanerStopOrdering: true,
    multiCleanerDispatch: true,
    routeReoptimization: false,
    multipleStartLocations: false,
    driveTimeReports: false,
  },
  pro: {
    dayMap: true,
    singleCleanerStopOrdering: true,
    multiCleanerDispatch: true,
    routeReoptimization: true,
    multipleStartLocations: true,
    driveTimeReports: true,
  },
  trial: {
    dayMap: true,
    singleCleanerStopOrdering: true,
    multiCleanerDispatch: false,
    routeReoptimization: false,
    multipleStartLocations: false,
    driveTimeReports: false,
  },
};

function billingAdmin(row: { status: string; platform_plan: string | null } | null) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: row, error: null }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

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
      expect(routingFeaturesForPlan(plan)).toEqual(ROUTING_MATRIX[plan]);
      for (const feature of ROUTING_ENTITLEMENT_FEATURES) {
        expect(isFeatureEnabled(plan, feature)).toBe(ROUTING_MATRIX[plan][feature]);
      }
    }

    expect(TRIAL_ENTITLEMENTS.features.dayMap).toBe(true);
    expect(featureUpgradeMessage('multiCleanerDispatch')).toContain('Business');
    expect(featureUpgradeMessage('routeReoptimization')).toContain('Pro');
    expect(featureUpgradeMessage('dayMap')).toContain('Starter');
    for (const feature of ROUTING_ENTITLEMENT_FEATURES) {
      expect(featureUpgradeMessage(feature).toLowerCase()).not.toContain('add-on');
    }
  });

  it('follows the trial profile for trialing rows and keeps paid routing on active or past_due', async () => {
    const tenantId = 'tenant-1';
    expect(
      await resolveTenantEntitlementPlan(
        billingAdmin({ status: 'trialing', platform_plan: null }),
        tenantId,
      ),
    ).toBe('trial');
    expect(
      await resolveTenantEntitlementPlan(
        billingAdmin({ status: 'trialing', platform_plan: 'pro' }),
        tenantId,
      ),
    ).toBe('trial');
    expect(await resolveTenantEntitlementPlan(billingAdmin(null), tenantId)).toBe('trial');
    expect(
      await resolveTenantEntitlementPlan(
        billingAdmin({ status: 'active', platform_plan: 'business' }),
        tenantId,
      ),
    ).toBe('business');
    expect(
      await resolveTenantEntitlementPlan(
        billingAdmin({ status: 'past_due', platform_plan: 'starter' }),
        tenantId,
      ),
    ).toBe('starter');
    expect(
      await resolveTenantEntitlementPlan(
        billingAdmin({ status: 'canceled', platform_plan: 'pro' }),
        tenantId,
      ),
    ).toBe('pro');
  });

  it('does not add a paused or inactive routing profile', () => {
    expect(mapStripeSubscriptionStatus('paused')).toBe('active');
    expect(
      isTenantPortalSuspended(
        resolveTenantSubscriptionAccess({
          billingStatus: 'canceled',
          trialEndsAt: null,
          tenantIsActive: true,
          stripeSubscriptionId: 'sub_123',
        }),
      ),
    ).toBe(true);
    expect(
      isTenantPortalSuspended(
        resolveTenantSubscriptionAccess({
          billingStatus: 'active',
          trialEndsAt: null,
          tenantIsActive: false,
          stripeSubscriptionId: 'sub_123',
        }),
      ),
    ).toBe(true);
    expect(
      isTenantPortalSuspended(
        resolveTenantSubscriptionAccess({
          billingStatus: 'active',
          trialEndsAt: null,
          tenantIsActive: true,
          stripeSubscriptionId: 'sub_123',
        }),
      ),
    ).toBe(false);
    expect(
      isTenantPortalSuspended(
        resolveTenantSubscriptionAccess({
          billingStatus: 'past_due',
          trialEndsAt: null,
          tenantIsActive: true,
          stripeSubscriptionId: 'sub_123',
        }),
      ),
    ).toBe(false);
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
