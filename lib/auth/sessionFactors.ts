import { cache } from 'react';
import {
  amrMethodsFromAccessToken,
  aalFromAccessToken,
  sessionIdFromAccessToken,
} from '@/lib/auth/accessTokenAmr';
import { readRequestAuthGrant } from '@/lib/auth/readRequestAuthGrant';
import { getAuthContext } from '@/lib/auth/session';
import { sessionUsedPasskey, type SessionFactors } from '@/lib/auth/tenantAuthPolicy';
import { createAdminClient, createClient } from '@/lib/supabase/server';

async function loadSessionFactors(): Promise<SessionFactors> {
  const grant = await readRequestAuthGrant();

  let amrMethods: string[];
  let authenticatorVerifiedThisSession: boolean;
  let authenticatorEnrolled: boolean;
  let sessionId: string | null;

  if (grant) {
    amrMethods = grant.amr;
    authenticatorVerifiedThisSession = grant.aal === 'aal2';
    authenticatorEnrolled = grant.factors.some((factor) => factor.factorType === 'totp');
    sessionId = grant.sid;
  } else {
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    sessionId = sessionIdFromAccessToken(accessToken);
    const auth = await getAuthContext();
    amrMethods = amrMethodsFromAccessToken(accessToken);
    authenticatorVerifiedThisSession = aalFromAccessToken(accessToken) === 'aal2';
    authenticatorEnrolled = (auth?.user.factors ?? []).some(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    );
  }

  let markedPasskey = false;
  if (sessionId && !sessionUsedPasskey(amrMethods)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('user_passkey_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .maybeSingle();
    markedPasskey = Boolean(data);
  }

  return {
    amrMethods:
      markedPasskey && !amrMethods.includes('passkey') ? [...amrMethods, 'passkey'] : amrMethods,
    authenticatorVerifiedThisSession,
    authenticatorEnrolled,
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
