import { headers } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';
import { trustedClientIp } from '@/lib/booking/bookingGuards';
import { turnstileMode, verifyTurnstileResponse } from '@/lib/booking/turnstile';

const CHALLENGE_ERROR = 'Confirm you are a person before continuing.';

export async function bookingChallengeError(formData: FormData): Promise<string | null> {
  const mode = turnstileMode({
    siteKey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    secret: serverEnv.TURNSTILE_SECRET_KEY,
  });
  if (mode === 'off') return null;
  if (mode === 'misconfigured') return 'Booking protection is not configured.';
  const ok = await verifyTurnstileResponse({
    token: String(formData.get('cf-turnstile-response') ?? ''),
    secret: serverEnv.TURNSTILE_SECRET_KEY ?? '',
    remoteIp: trustedClientIp(await headers()),
  });
  return ok ? null : CHALLENGE_ERROR;
}
