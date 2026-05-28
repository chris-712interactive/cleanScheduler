import { publicEnv, serverEnv } from '@/lib/env';

/** Mirrors `app/marketing/onboarding/actions.ts` for auth + invite flows. */
export function shouldAutoConfirmEmail(): boolean {
  const mode = serverEnv.ONBOARDING_EMAIL_CONFIRM_MODE;
  if (mode === 'required') return false;
  if (mode === 'disabled') return true;
  return publicEnv.NEXT_PUBLIC_APP_ENV !== 'prod';
}
