import { describe, expect, it } from 'vitest';
import {
  nextTrialEndsAt,
  parseTrialExtensionDays,
  trialExtensionBlockReason,
} from '@/lib/billing/extendTenantTrial';

const openTrial = {
  status: 'trialing' as const,
  trial_ends_at: '2026-10-07T00:00:00.000Z',
  trial_started_at: '2026-09-30T00:00:00.000Z',
  activated_at: null,
  stripe_subscription_id: null,
};

describe('trialExtensionBlockReason', () => {
  it('allows an open database trial and a never-activated expired trial', () => {
    expect(trialExtensionBlockReason(openTrial)).toBeNull();
    expect(
      trialExtensionBlockReason({
        ...openTrial,
        status: 'canceled',
        trial_ends_at: '2026-09-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('refuses paid, Stripe-managed, and already-activated workspaces', () => {
    expect(trialExtensionBlockReason({ ...openTrial, status: 'active' })).toMatch(/paid/);
    expect(trialExtensionBlockReason({ ...openTrial, stripe_subscription_id: 'sub_123' })).toMatch(
      /Stripe/,
    );
    expect(
      trialExtensionBlockReason({
        ...openTrial,
        status: 'canceled',
        activated_at: '2026-08-01T00:00:00.000Z',
      }),
    ).toMatch(/already subscribed/);
  });
});

describe('nextTrialEndsAt', () => {
  const now = new Date('2026-09-30T12:00:00.000Z');

  it('adds days onto a trial that is still running', () => {
    expect(nextTrialEndsAt('2026-10-07T00:00:00.000Z', 7, now)).toBe('2026-10-14T00:00:00.000Z');
  });

  it('starts from today when the trial already ended', () => {
    expect(nextTrialEndsAt('2026-09-01T00:00:00.000Z', 7, now)).toBe('2026-10-07T12:00:00.000Z');
  });
});

describe('parseTrialExtensionDays', () => {
  it('accepts 1 through 90 whole days', () => {
    expect(parseTrialExtensionDays('7')).toBe(7);
    expect(parseTrialExtensionDays('0')).toBeNull();
    expect(parseTrialExtensionDays('91')).toBeNull();
    expect(parseTrialExtensionDays('3.5')).toBeNull();
  });
});
