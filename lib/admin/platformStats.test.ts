import { describe, expect, it } from 'vitest';
import { monthlyRecurringCentsForAccount } from '@/lib/admin/platformStats';

describe('monthlyRecurringCentsForAccount', () => {
  it('prices an active Stripe subscription from the plan and interval', () => {
    expect(
      monthlyRecurringCentsForAccount({
        status: 'active',
        platform_plan: 'starter',
        billing_interval: 'month',
        admin_granted_at: null,
      }),
    ).toBe(3900);
    expect(
      monthlyRecurringCentsForAccount({
        status: 'active',
        platform_plan: 'pro',
        billing_interval: 'year',
        admin_granted_at: null,
      }),
    ).toBe(23900);
  });

  it('leaves an admin-granted plan out of estimated MRR', () => {
    expect(
      monthlyRecurringCentsForAccount({
        status: 'active',
        platform_plan: 'business',
        billing_interval: 'month',
        admin_granted_at: '2026-10-27T00:00:00.000Z',
      }),
    ).toBe(0);
  });

  it('still estimates a trialing workspace the same way as before', () => {
    expect(
      monthlyRecurringCentsForAccount({
        status: 'trialing',
        platform_plan: null,
        billing_interval: null,
        admin_granted_at: null,
      }),
    ).toBe(3900);
  });
});
