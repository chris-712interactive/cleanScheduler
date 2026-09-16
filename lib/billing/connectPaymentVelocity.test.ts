import { describe, expect, it } from 'vitest';
import {
  CONNECT_VELOCITY_CUSTOMER_LIMIT_MESSAGE,
  CONNECT_VELOCITY_TENANT_LIMIT_MESSAGE,
  evaluateConnectVelocityCounts,
  isWithinNewTenantVelocityWindow,
} from '@/lib/billing/connectPaymentVelocity';

describe('isWithinNewTenantVelocityWindow', () => {
  it('applies caps when activated_at is missing', () => {
    expect(isWithinNewTenantVelocityWindow(null)).toBe(true);
  });

  it('applies caps within the first 14 days after activation', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    expect(isWithinNewTenantVelocityWindow('2026-09-10T12:00:00.000Z', now)).toBe(true);
  });

  it('stops applying caps after 14 days', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    expect(isWithinNewTenantVelocityWindow('2026-08-01T12:00:00.000Z', now)).toBe(false);
  });
});

describe('evaluateConnectVelocityCounts', () => {
  it('allows activity under both caps', () => {
    expect(
      evaluateConnectVelocityCounts({
        tenantPayments: 2,
        tenantCheckoutStarts: 2,
        customerPayments: 1,
        customerCheckoutStarts: 1,
      }),
    ).toEqual({ ok: true });
  });

  it('blocks at 3 tenant payments (5×$20 pattern)', () => {
    const result = evaluateConnectVelocityCounts({
      tenantPayments: 3,
      tenantCheckoutStarts: 0,
      customerPayments: 0,
      customerCheckoutStarts: 0,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'tenant',
      message: CONNECT_VELOCITY_TENANT_LIMIT_MESSAGE,
    });
  });

  it('blocks at 3 tenant checkout starts before payments land', () => {
    const result = evaluateConnectVelocityCounts({
      tenantPayments: 0,
      tenantCheckoutStarts: 3,
      customerPayments: 0,
      customerCheckoutStarts: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tenant');
  });

  it('blocks at 2 charges for the same customer', () => {
    const result = evaluateConnectVelocityCounts({
      tenantPayments: 2,
      tenantCheckoutStarts: 2,
      customerPayments: 2,
      customerCheckoutStarts: 0,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'customer',
      message: CONNECT_VELOCITY_CUSTOMER_LIMIT_MESSAGE,
    });
  });
});
