import { describe, expect, it } from 'vitest';
import {
  canReturnManualSubscriptionToTrial,
  manualSubscriptionGrantBlockReason,
  RESTORED_TRIAL_DAYS,
  restoredTrialEndsAt,
  shouldPreserveAdminSubscriptionGrant,
} from '@/lib/billing/grantTenantSubscription';

const openTrial = {
  status: 'trialing' as const,
  stripe_subscription_id: null,
};

describe('manualSubscriptionGrantBlockReason', () => {
  it('allows a workspace that is not billed in Stripe', () => {
    expect(manualSubscriptionGrantBlockReason({ stripe_subscription_id: null })).toBeNull();
  });

  it('refuses a live Stripe subscription', () => {
    expect(
      manualSubscriptionGrantBlockReason({
        stripe_subscription_id: 'sub_123',
      }),
    ).toMatch(/Stripe/);
  });

  it('refuses a missing billing row', () => {
    expect(manualSubscriptionGrantBlockReason(null)).toMatch(/no billing record/);
  });
});

describe('canReturnManualSubscriptionToTrial', () => {
  it('allows an active or past-due workspace with no Stripe subscription', () => {
    expect(canReturnManualSubscriptionToTrial({ ...openTrial, status: 'active' })).toBe(true);
    expect(canReturnManualSubscriptionToTrial({ ...openTrial, status: 'past_due' })).toBe(true);
  });

  it('leaves trial and Stripe-billed workspaces on their current path', () => {
    expect(canReturnManualSubscriptionToTrial(openTrial)).toBe(false);
    expect(
      canReturnManualSubscriptionToTrial({
        status: 'active',
        stripe_subscription_id: 'sub_123',
      }),
    ).toBe(false);
    expect(canReturnManualSubscriptionToTrial(null)).toBe(false);
  });
});

describe('shouldPreserveAdminSubscriptionGrant', () => {
  it('ignores a canceled Stripe event while an admin grant is in place', () => {
    expect(
      shouldPreserveAdminSubscriptionGrant({
        adminGrantedAt: '2026-10-27T00:00:00.000Z',
        incomingStatus: 'canceled',
      }),
    ).toBe(true);
  });

  it('lets a live Stripe subscription replace the grant', () => {
    expect(
      shouldPreserveAdminSubscriptionGrant({
        adminGrantedAt: '2026-10-27T00:00:00.000Z',
        incomingStatus: 'active',
      }),
    ).toBe(false);
    expect(
      shouldPreserveAdminSubscriptionGrant({
        adminGrantedAt: null,
        incomingStatus: 'canceled',
      }),
    ).toBe(false);
  });
});

describe('restoredTrialEndsAt', () => {
  const now = new Date('2026-10-27T15:00:00.000Z');

  it('keeps a trial end that is still in the future', () => {
    expect(restoredTrialEndsAt('2026-11-02T00:00:00.000Z', now)).toBe('2026-11-02T00:00:00.000Z');
  });

  it('starts a new trial window when the previous end has passed', () => {
    const restored = restoredTrialEndsAt('2026-10-01T00:00:00.000Z', now);
    const expected = new Date(now);
    expected.setUTCDate(expected.getUTCDate() + RESTORED_TRIAL_DAYS);
    expect(restored).toBe(expected.toISOString());
  });
});
