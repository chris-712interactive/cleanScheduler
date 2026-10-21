import { describe, expect, it } from 'vitest';
import {
  buildConnectAccountNotice,
  buildTrialAccountNotice,
  buildUsageAccountNotice,
} from '@/lib/billing/accountNotices';
import type { UtilizationAlert } from '@/lib/billing/usageUtilization';

function usageAlert(overrides: Partial<UtilizationAlert> = {}): UtilizationAlert {
  return {
    key: 'includedOfficeSeats',
    label: 'Office seats',
    used: 2,
    limit: 2,
    ratio: 1,
    level: 'exceeded',
    ...overrides,
  };
}

describe('buildTrialAccountNotice', () => {
  it('stays quiet once the workspace is subscribed or paused', () => {
    expect(buildTrialAccountNotice('active', 18)).toBeNull();
    expect(buildTrialAccountNotice('suspended', 0)).toBeNull();
    expect(buildTrialAccountNotice('trial_expired', 0)).toBeNull();
  });

  it('uses a short trial countdown while plenty of days remain', () => {
    expect(buildTrialAccountNotice('trialing', 18)).toMatchObject({
      id: 'trial',
      tone: 'info',
      label: 'Trial · 18 days',
      detail: 'Quotes, scheduling, and invoicing are included.',
      href: '/billing',
      actionLabel: 'Choose a plan',
    });
  });

  it('switches to a warning in the last three days', () => {
    expect(buildTrialAccountNotice('trialing', 1)).toMatchObject({
      tone: 'warning',
      label: 'Trial · 1 day',
      actionLabel: 'Subscribe',
    });
    expect(buildTrialAccountNotice('trialing', 0)?.label).toBe('Trial ends today');
  });

  it('flags a past-due payment', () => {
    expect(buildTrialAccountNotice('past_due', 10)).toMatchObject({
      tone: 'warning',
      label: 'Payment past due',
      actionLabel: 'Update billing',
    });
  });
});

describe('buildUsageAccountNotice', () => {
  it('names a full meter without a full-width sentence on the chip', () => {
    expect(buildUsageAccountNotice(usageAlert())).toMatchObject({
      id: 'usage',
      tone: 'warning',
      label: 'Office seats full',
      href: '/billing',
      actionLabel: 'View billing',
    });
  });

  it('shows a percent before the limit is reached', () => {
    expect(
      buildUsageAccountNotice(usageAlert({ used: 8, limit: 10, ratio: 0.8, level: 'warn' })),
    ).toMatchObject({
      tone: 'info',
      label: 'Office seats 80%',
    });
  });
});

describe('buildConnectAccountNotice', () => {
  it('stays quiet once card payments are connected', () => {
    expect(buildConnectAccountNotice('complete')).toBeNull();
  });

  it('asks to connect Stripe in a short label', () => {
    expect(buildConnectAccountNotice('not_started')).toMatchObject({
      id: 'connect',
      label: 'Card payments',
      href: '/billing/payment-setup',
    });
  });
});
