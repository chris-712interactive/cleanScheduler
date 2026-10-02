import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Customer portal invites and referral referee signup honor `ONBOARDING_EMAIL_CONFIRM_MODE`.
 * Free-trial owners and employee invites always confirm at create — see
 * {@link shouldAutoConfirmTrialOwnerEmail} and {@link shouldAutoConfirmInvitedEmployeeEmail}.
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
