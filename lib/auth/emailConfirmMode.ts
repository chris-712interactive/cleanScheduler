import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Invite / employee / referral flows honor `ONBOARDING_EMAIL_CONFIRM_MODE`.
 * Free-trial workspace owners always use {@link shouldAutoConfirmTrialOwnerEmail}.
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
