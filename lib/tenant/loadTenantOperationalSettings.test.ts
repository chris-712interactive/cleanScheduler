import { describe, expect, it } from 'vitest';
import {
  isPaymentMethodAllowedForCustomer,
  parsePreferredPaymentMethod,
  resolveRequiredPreferredPaymentMethod,
  type TenantOperationalSettingsSnapshot,
} from '@/lib/tenant/loadTenantOperationalSettings';

const baseOps: TenantOperationalSettingsSnapshot = {
  acceptedQuoteScheduleMode: 'prompt_staff',
  invoiceExpectation: 'pay_after_service',
  allowedCustomerPaymentMethods: ['check', 'zelle', 'card'],
  requireConsultationBeforeQuote: true,
};

describe('parsePreferredPaymentMethod', () => {
  it('parses valid methods', () => {
    expect(parsePreferredPaymentMethod('check')).toBe('check');
  });

  it('rejects invalid methods', () => {
    expect(parsePreferredPaymentMethod('bitcoin')).toBeNull();
    expect(parsePreferredPaymentMethod('')).toBeNull();
  });
});

describe('resolveRequiredPreferredPaymentMethod', () => {
  it('auto-selects when only one method allowed', () => {
    const ops: TenantOperationalSettingsSnapshot = {
      ...baseOps,
      allowedCustomerPaymentMethods: ['zelle'],
    };
    expect(resolveRequiredPreferredPaymentMethod(ops, '')).toBe('zelle');
  });

  it('requires explicit choice when multiple allowed', () => {
    expect(resolveRequiredPreferredPaymentMethod(baseOps, '')).toEqual({
      error: 'Choose how you plan to pay before accepting this quote.',
    });
  });

  it('rejects disallowed method', () => {
    expect(resolveRequiredPreferredPaymentMethod(baseOps, 'cash')).toEqual({
      error: 'That payment method is not accepted for this quote.',
    });
  });

  it('accepts allowed method', () => {
    expect(resolveRequiredPreferredPaymentMethod(baseOps, 'check')).toBe('check');
  });
});

describe('isPaymentMethodAllowedForCustomer', () => {
  it('checks membership in allowed list', () => {
    expect(isPaymentMethodAllowedForCustomer(baseOps, 'card')).toBe(true);
    expect(isPaymentMethodAllowedForCustomer(baseOps, 'ach')).toBe(false);
  });
});
