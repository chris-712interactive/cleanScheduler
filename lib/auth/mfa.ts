import { createClient } from '@/lib/supabase/server';

export type MfaStatus = {
  enrolled: boolean;
  verifiedThisSession: boolean;
  factorId: string | null;
};

/** Returns MFA enrollment and assurance level for the current session. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();

  const [{ data: factorsData }, { data: aalData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  const verifiedTotp = (factorsData?.totp ?? []).find((f) => f.status === 'verified');
  const enrolled = Boolean(verifiedTotp);

  return {
    enrolled,
    verifiedThisSession: aalData?.currentLevel === 'aal2',
    factorId: verifiedTotp?.id ?? null,
  };
}

/** True when the user must complete MFA before the session reaches AAL2. */
export async function needsMfaChallenge(): Promise<boolean> {
  const supabase = await createClient();
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aalData) return false;
  return aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2';
}
