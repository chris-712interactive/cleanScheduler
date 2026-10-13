import { getSessionFactors } from '@/lib/auth/sessionFactors';
import { getAuthContext } from '@/lib/auth/session';

export type MfaStatus = {
  enrolled: boolean;
  verifiedThisSession: boolean;
  factorId: string | null;
};

/** Returns MFA enrollment and assurance level for the current session. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const [factors, auth] = await Promise.all([getSessionFactors(), getAuthContext()]);
  const verifiedTotp = (auth?.user.factors ?? []).find(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );

  return {
    enrolled: Boolean(verifiedTotp),
    verifiedThisSession: factors.authenticatorVerifiedThisSession,
    factorId: verifiedTotp?.id ?? null,
  };
}

/** True when the user must complete MFA before the session reaches AAL2. */
export async function needsMfaChallenge(): Promise<boolean> {
  const [factors, auth] = await Promise.all([getSessionFactors(), getAuthContext()]);
  const anyVerified = (auth?.user.factors ?? []).some((factor) => factor.status === 'verified');
  if (!anyVerified) return false;
  return !factors.authenticatorVerifiedThisSession;
}
