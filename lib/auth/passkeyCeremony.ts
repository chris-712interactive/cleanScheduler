'use server';

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { headers } from 'next/headers';
import { sessionIdFromAccessToken } from '@/lib/auth/accessTokenAmr';
import {
  PASSKEY_CHALLENGE_TTL_MS,
  PASSKEY_MAX_PER_USER,
  PASSKEY_RP_NAME,
  passkeyContextForOrigin,
  passkeyFriendlyName,
} from '@/lib/auth/passkeyRp';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient, createClient } from '@/lib/supabase/server';

type PasskeySummary = {
  id: string;
  friendlyName: string;
  createdAt: string;
};

type ChallengeKind = 'registration' | 'authentication';

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const source = Buffer.from(value, 'base64url');
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes;
}

async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const referer = h.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

async function requirePasskeyContext(): Promise<
  { origin: string; rpId: string } | { error: string }
> {
  const origin = await requestOrigin();
  if (!origin) return { error: 'Passkeys are not available on this address.' };
  const context = passkeyContextForOrigin(origin);
  if (!context) return { error: 'Passkeys are not available on this address.' };
  return context;
}

async function saveChallenge(options: {
  challenge: string;
  kind: ChallengeKind;
  userId: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS).toISOString();
  await admin.from('user_passkey_challenges').delete().lt('expires_at', new Date().toISOString());
  const { data, error } = await admin
    .from('user_passkey_challenges')
    .insert({
      user_id: options.userId,
      challenge: options.challenge,
      kind: options.kind,
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

async function takeChallenge(options: {
  challengeId: string;
  kind: ChallengeKind;
  userId?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  let query = admin
    .from('user_passkey_challenges')
    .select('id, challenge, user_id, expires_at')
    .eq('id', options.challengeId)
    .eq('kind', options.kind);
  if (options.userId) query = query.eq('user_id', options.userId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await admin.from('user_passkey_challenges').delete().eq('id', data.id);
    return null;
  }
  await admin.from('user_passkey_challenges').delete().eq('id', data.id);
  return data.challenge;
}

export async function listMyPasskeys(): Promise<{ passkeys: PasskeySummary[]; error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { passkeys: [], error: 'Sign in before managing passkeys.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('user_passkeys')
    .select('id, friendly_name, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });
  if (error) return { passkeys: [], error: 'Could not load passkeys.' };

  return {
    passkeys: (data ?? []).map((row) => ({
      id: row.id,
      friendlyName: row.friendly_name,
      createdAt: row.created_at,
    })),
  };
}

export async function deleteMyPasskey(passkeyId: string): Promise<{ error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { error: 'Sign in before managing passkeys.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_passkeys')
    .delete()
    .eq('id', passkeyId)
    .eq('user_id', auth.user.id);
  if (error) return { error: 'Could not remove that passkey.' };
  return {};
}

export async function startPasskeyRegistration(): Promise<{
  challengeId?: string;
  options?: Awaited<ReturnType<typeof generateRegistrationOptions>>;
  error?: string;
}> {
  const context = await requirePasskeyContext();
  if ('error' in context) return { error: context.error };

  const auth = await getAuthContext();
  if (!auth?.user.email) return { error: 'Sign in before adding a passkey.' };

  const admin = createAdminClient();
  const { data: existing, error: listError } = await admin
    .from('user_passkeys')
    .select('credential_id, transports')
    .eq('user_id', auth.user.id);
  if (listError) return { error: 'Could not start passkey setup.' };
  if ((existing ?? []).length >= PASSKEY_MAX_PER_USER) {
    return { error: 'This account already has the maximum number of passkeys.' };
  }

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: context.rpId,
    userName: auth.user.email,
    userDisplayName: auth.user.email,
    userID: new TextEncoder().encode(auth.user.id),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    excludeCredentials: (existing ?? []).map((row) => ({
      id: row.credential_id,
      transports: row.transports,
    })),
  });

  const challengeId = await saveChallenge({
    challenge: options.challenge,
    kind: 'registration',
    userId: auth.user.id,
  });
  if (!challengeId) return { error: 'Could not start passkey setup.' };
  return { challengeId, options };
}

export async function finishPasskeyRegistration(
  challengeId: string,
  response: RegistrationResponseJSON,
): Promise<{ error?: string }> {
  const context = await requirePasskeyContext();
  if ('error' in context) return { error: context.error };

  const auth = await getAuthContext();
  if (!auth) return { error: 'Sign in before adding a passkey.' };

  const challenge = await takeChallenge({
    challengeId,
    kind: 'registration',
    userId: auth.user.id,
  });
  if (!challenge) return { error: 'Passkey setup expired. Try again.' };

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: context.origin,
      expectedRPID: context.rpId,
      requireUserVerification: true,
    });
  } catch {
    return { error: 'Could not verify this passkey.' };
  }
  if (!verification.verified) return { error: 'Could not verify this passkey.' };

  const { credential, aaguid } = verification.registrationInfo;
  const admin = createAdminClient();
  const { error } = await admin.from('user_passkeys').insert({
    user_id: auth.user.id,
    credential_id: credential.id,
    public_key: bytesToBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    friendly_name: passkeyFriendlyName(aaguid),
  });
  if (error) {
    if (error.code === '23505')
      return { error: 'This device already has a passkey for your account.' };
    return { error: 'Could not save this passkey.' };
  }
  return {};
}

export async function startPasskeyAuthentication(): Promise<{
  challengeId?: string;
  options?: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
  error?: string;
}> {
  const context = await requirePasskeyContext();
  if ('error' in context) return { error: context.error };

  const options = await generateAuthenticationOptions({
    rpID: context.rpId,
    userVerification: 'required',
  });
  const challengeId = await saveChallenge({
    challenge: options.challenge,
    kind: 'authentication',
    userId: null,
  });
  if (!challengeId) return { error: 'Could not start passkey sign-in.' };
  return { challengeId, options };
}

/**
 * Verifies a passkey, then opens a Supabase session for that user.
 * When `requireCurrentUser` is set, the passkey must belong to the person already signed in.
 */
export async function finishPasskeyAuthentication(
  challengeId: string,
  response: AuthenticationResponseJSON,
  options?: { requireCurrentUser?: boolean },
): Promise<{ error?: string }> {
  const context = await requirePasskeyContext();
  if ('error' in context) return { error: context.error };

  const current = options?.requireCurrentUser ? await getAuthContext() : null;
  if (options?.requireCurrentUser && !current) {
    return { error: 'Sign in before verifying with a passkey.' };
  }

  const challenge = await takeChallenge({ challengeId, kind: 'authentication' });
  if (!challenge) return { error: 'Passkey sign-in expired. Try again.' };

  const admin = createAdminClient();
  const { data: passkey, error: lookupError } = await admin
    .from('user_passkeys')
    .select('id, user_id, credential_id, public_key, counter, transports')
    .eq('credential_id', response.id)
    .maybeSingle();
  if (lookupError || !passkey) return { error: 'This passkey is not registered.' };
  if (current && passkey.user_id !== current.user.id) {
    return { error: 'Use the passkey for the account you are signed in with.' };
  }

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: context.origin,
      expectedRPID: context.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: base64UrlToBytes(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
    });
  } catch {
    return { error: 'Could not verify this passkey.' };
  }
  if (!verification.verified) return { error: 'Could not verify this passkey.' };

  const { error: counterError } = await admin
    .from('user_passkeys')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', passkey.id);
  if (counterError) return { error: 'Could not finish passkey sign-in.' };

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(passkey.user_id);
  const user = userData?.user;
  if (userError || !user?.email) return { error: 'Could not find an account for this passkey.' };
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return { error: 'Confirm your email before using a passkey.' };
  }
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    return { error: 'This account cannot sign in.' };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) return { error: 'Could not start a session for this passkey.' };

  const supabase = await createClient();
  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  const accessToken = sessionData.session?.access_token;
  const sessionId = sessionIdFromAccessToken(accessToken);
  if (verifyError || !sessionId) {
    return { error: 'Could not start a session for this passkey.' };
  }

  const { error: markerError } = await admin.from('user_passkey_sessions').insert({
    session_id: sessionId,
    user_id: user.id,
  });
  if (markerError) {
    await supabase.auth.signOut();
    return { error: 'Could not record this passkey sign-in.' };
  }

  return {};
}
