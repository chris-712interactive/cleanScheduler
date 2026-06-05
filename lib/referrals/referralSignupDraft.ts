import type { ReferralJoinPrefill } from '@/lib/referrals/referralRefereeOnboarding';

export type ReferralSignupStep = 'profile' | 'address' | 'account';

export const REFERRAL_SIGNUP_STEPS: { id: ReferralSignupStep; label: string }[] = [
  { id: 'profile', label: 'About you' },
  { id: 'address', label: 'Service address' },
  { id: 'account', label: 'Portal login' },
];

export type ReferralSignupDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  serviceCity: string;
  serviceState: string;
  servicePostalCode: string;
  password: string;
  confirmPassword: string;
  smsOptIn: boolean;
  marketingEmailOptIn: boolean;
};

export type ReferralSignupFieldErrors = Partial<Record<keyof ReferralSignupDraft, string>>;

export function draftFromPrefill(prefill: ReferralJoinPrefill): ReferralSignupDraft {
  return {
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    phone: prefill.phone,
    serviceAddressLine1: prefill.serviceAddressLine1,
    serviceAddressLine2: prefill.serviceAddressLine2,
    serviceCity: prefill.serviceCity,
    serviceState: prefill.serviceState,
    servicePostalCode: prefill.servicePostalCode,
    password: '',
    confirmPassword: '',
    smsOptIn: false,
    marketingEmailOptIn: false,
  };
}

export function draftFromFormData(formData: FormData): ReferralSignupDraft {
  return {
    firstName: String(formData.get('first_name') ?? '').trim(),
    lastName: String(formData.get('last_name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    serviceAddressLine1: String(formData.get('service_address_line1') ?? '').trim(),
    serviceAddressLine2: String(formData.get('service_address_line2') ?? '').trim(),
    serviceCity: String(formData.get('service_city') ?? '').trim(),
    serviceState: String(formData.get('service_state') ?? '').trim(),
    servicePostalCode: String(formData.get('service_postal_code') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirm_password') ?? ''),
    smsOptIn: formData.get('sms_opt_in') === 'on',
    marketingEmailOptIn: formData.get('marketing_email_opt_in') === 'on',
  };
}

export function validateReferralSignupStep(
  step: ReferralSignupStep,
  draft: ReferralSignupDraft,
): { ok: true } | { ok: false; errors: ReferralSignupFieldErrors; message: string } {
  const errors: ReferralSignupFieldErrors = {};

  if (step === 'profile') {
    if (!draft.firstName.trim()) {
      errors.firstName = 'First name is required.';
    }
  }

  if (step === 'address') {
    if (!draft.serviceAddressLine1.trim()) {
      errors.serviceAddressLine1 = 'Street address is required.';
    }
    if (!draft.serviceCity.trim()) {
      errors.serviceCity = 'City is required.';
    }
    if (!draft.serviceState.trim()) {
      errors.serviceState = 'State or region is required.';
    }
    if (!draft.servicePostalCode.trim()) {
      errors.servicePostalCode = 'Postal code is required.';
    }
  }

  if (step === 'account') {
    if (!draft.password || draft.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (!draft.confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (draft.password !== draft.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (draft.smsOptIn && !draft.phone.trim()) {
      errors.phone = 'Enter a phone number to opt in to SMS.';
    }
  }

  const firstError = Object.values(errors)[0];
  if (firstError) {
    return { ok: false, errors, message: firstError };
  }

  return { ok: true };
}

export function signupStepIndex(step: ReferralSignupStep): number {
  return REFERRAL_SIGNUP_STEPS.findIndex((entry) => entry.id === step);
}

export function nextSignupStep(step: ReferralSignupStep): ReferralSignupStep | null {
  const index = signupStepIndex(step);
  return REFERRAL_SIGNUP_STEPS[index + 1]?.id ?? null;
}

export function previousSignupStep(step: ReferralSignupStep): ReferralSignupStep | null {
  const index = signupStepIndex(step);
  return index > 0 ? REFERRAL_SIGNUP_STEPS[index - 1]!.id : null;
}
