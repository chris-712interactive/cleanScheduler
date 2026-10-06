import { cache } from 'react';
import { amrMethodsFromAccessToken, sessionIdFromAccessToken } from '@/lib/auth/accessTokenAmr';
import type { SessionFactors } from '@/lib/auth/tenantAuthPolicy';
import { createAdminClient, createClient } from '@/lib/supabase/server';

async function loadSessionFactors(): Promise<SessionFactors> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: factorsData }, { data: aalData }, { data: sessionData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.getSession(),
  ]);

  const accessToken = sessionData.session?.access_token;
  const amrMethods = amrMethodsFromAccessToken(accessToken);
  const sessionId = sessionIdFromAccessToken(accessToken);
  let markedPasskey = false;
  if (sessionId) {
    const { data } = await admin
      .from('user_passkey_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .maybeSingle();
    markedPasskey = Boolean(data);
  }

  const verifiedTotp = (factorsData?.totp ?? []).find((factor) => factor.status === 'verified');

  return {
    amrMethods:
      markedPasskey && !amrMethods.includes('passkey') ? [...amrMethods, 'passkey'] : amrMethods,
    authenticatorVerifiedThisSession: aalData?.currentLevel === 'aal2',
    authenticatorEnrolled: Boolean(verifiedTotp),
    passkeyEnrolled: false,
  };
}

/** Current session factors. Passkey enrollment is filled in only when a caller needs it. */
export const getSessionFactors = cache(loadSessionFactors);

export async function userHasRegisteredPasskey(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('user_passkeys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error || count == null) return false;
  return count > 0;
}
