import { describe, expect, it } from 'vitest';
import {
  draftFromPrefill,
  validateReferralSignupStep,
  type ReferralSignupDraft,
} from '@/lib/referrals/referralSignupDraft';

const baseDraft: ReferralSignupDraft = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '5551234567',
  serviceAddressLine1: '123 Main St',
  serviceAddressLine2: '',
  serviceCity: 'Springfield',
  serviceState: 'IL',
  servicePostalCode: '62701',
  password: 'password123',
  confirmPassword: 'password123',
  smsOptIn: false,
  marketingEmailOptIn: false,
};

describe('validateReferralSignupStep', () => {
  it('requires first name on profile step', () => {
    const result = validateReferralSignupStep('profile', { ...baseDraft, firstName: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.firstName).toBeTruthy();
    }
  });

  it('requires address fields on address step', () => {
    const result = validateReferralSignupStep('address', {
      ...baseDraft,
      serviceAddressLine1: '',
      serviceCity: '',
    });
    expect(result.ok).toBe(false);
  });

  it('requires matching passwords on account step', () => {
    const result = validateReferralSignupStep('account', {
      ...baseDraft,
      confirmPassword: 'different',
    });
    expect(result.ok).toBe(false);
  });

  it('requires phone when sms opt-in is enabled', () => {
    const result = validateReferralSignupStep('account', {
      ...baseDraft,
      smsOptIn: true,
      phone: '',
    });
    expect(result.ok).toBe(false);
  });
});

describe('draftFromPrefill', () => {
  it('maps prefill fields into an empty signup draft', () => {
    const draft = draftFromPrefill({
      customerId: 'cust-1',
      identityId: 'id-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555',
      serviceAddressLine1: '123 Main',
      serviceAddressLine2: 'Apt 2',
      serviceCity: 'Town',
      serviceState: 'TX',
      servicePostalCode: '75001',
    });

    expect(draft.firstName).toBe('Jane');
    expect(draft.password).toBe('');
    expect(draft.smsOptIn).toBe(false);
  });
});
