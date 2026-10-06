'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { passkeyErrorMessage } from '@/lib/auth/passkeyErrorMessage';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from '@/lib/auth/passkeyCeremony';

function ceremonyError(error: unknown): string {
  if (error instanceof Error) return passkeyErrorMessage(error);
  return 'Passkey prompt was canceled.';
}

/** Asks this device to create a passkey and stores the public key. */
export async function addPasskeyOnThisDevice(): Promise<string | null> {
  const started = await startPasskeyRegistration();
  if (started.error || !started.challengeId || !started.options) {
    return started.error ?? 'Could not start passkey setup.';
  }

  try {
    const credential = await startRegistration({ optionsJSON: started.options });
    const finished = await finishPasskeyRegistration(started.challengeId, credential);
    return finished.error ?? null;
  } catch (error) {
    return ceremonyError(error);
  }
}

/**
 * Asks this device for a passkey and, when it matches, opens a Supabase session.
 * Returns an error message, or null when the session is ready.
 */
export async function signInWithDevicePasskey(options?: {
  requireCurrentUser?: boolean;
}): Promise<string | null> {
  const started = await startPasskeyAuthentication();
  if (started.error || !started.challengeId || !started.options) {
    return started.error ?? 'Could not start passkey sign-in.';
  }

  try {
    const credential = await startAuthentication({ optionsJSON: started.options });
    const finished = await finishPasskeyAuthentication(started.challengeId, credential, {
      requireCurrentUser: options?.requireCurrentUser,
    });
    return finished.error ?? null;
  } catch (error) {
    return ceremonyError(error);
  }
}
