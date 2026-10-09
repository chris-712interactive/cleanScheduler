import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Referral referee signup honors `ONBOARDING_EMAIL_CONFIRM_MODE`.
 * Free-trial owners, employee invites, and customer portal invites always confirm
 * at create — see {@link shouldAutoConfirmTrialOwnerEmail},
 * {@link shouldAutoConfirmInvitedEmployeeEmail}, and
 * {@link shouldAutoConfirmCustomerPortalInviteEmail}.
 */
export function shouldAutoConfirmEmail(): boolean {
  const mode = serverEnv.ONBOARDING_EMAIL_CONFIRM_MODE;
  if (mode === 'required') return false;
  if (mode === 'disabled') return true;
  return publicEnv.NEXT_PUBLIC_APP_ENV !== 'prod';
}

/**
 * Trial owners are always confirmed at create so password sign-in and redirect
 * work immediately. Independent of prod `ONBOARDING_EMAIL_CONFIRM_MODE`.
 */
export function shouldAutoConfirmTrialOwnerEmail(): boolean {
  return true;
}

/**
 * Employee invite acceptance always confirms at create. The invite was emailed
 * to that address, so the token is the confirmation. Independent of prod
 * `ONBOARDING_EMAIL_CONFIRM_MODE`.
 */
export function shouldAutoConfirmInvitedEmployeeEmail(): boolean {
  return true;
}

/**
 * Customer portal invite acceptance always confirms at create. The invite was
 * emailed to that address, so the token is the confirmation. Independent of
 * prod `ONBOARDING_EMAIL_CONFIRM_MODE`.
 */
export function shouldAutoConfirmCustomerPortalInviteEmail(): boolean {
  return true;
}
