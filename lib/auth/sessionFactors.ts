import { cache } from 'react';
import { amrMethodsFromAccessToken } from '@/lib/auth/accessTokenAmr';
import type { SessionFactors } from '@/lib/auth/tenantAuthPolicy';
import { createAdminClient, createClient } from '@/lib/supabase/server';

async function loadSessionFactors(): Promise<SessionFactors> {
  const supabase = await createClient();
  const [{ data: factorsData }, { data: aalData }, { data: sessionData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.getSession(),
  ]);

  const verifiedTotp = (factorsData?.totp ?? []).find((factor) => factor.status === 'verified');

  return {
    amrMethods: amrMethodsFromAccessToken(sessionData.session?.access_token),
    authenticatorVerifiedThisSession: aalData?.currentLevel === 'aal2',
    authenticatorEnrolled: Boolean(verifiedTotp),
    passkeyEnrolled: false,
  };
}

/** Current session factors. Passkey enrollment is filled in only when a caller needs it. */
export const getSessionFactors = cache(loadSessionFactors);

export async function userHasRegisteredPasskey(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.passkey.listPasskeys({ userId });
  if (error || !data) return false;
  return data.length > 0;
}
