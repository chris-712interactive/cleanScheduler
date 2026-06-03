import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  attributeRefereeFromReferralCode,
  captureReferralFromCodeString,
} from '@/lib/referrals/referralAttribution';
import { REFERRAL_COOKIE_NAME } from '@/lib/referrals/referralTypes';
import { normalizeReferralCode } from '@/lib/referrals/normalizeReferralCode';

type Admin = SupabaseClient<Database>;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function setReferralCookie(code: string): Promise<void> {
  const jar = await cookies();
  jar.set(REFERRAL_COOKIE_NAME, normalizeReferralCode(code), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function readReferralCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(REFERRAL_COOKIE_NAME)?.value?.trim();
  return raw ? normalizeReferralCode(raw) : null;
}

export async function clearReferralCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REFERRAL_COOKIE_NAME);
}

export async function captureReferralFromRequest(
  admin: Admin,
  input: {
    rawCode: string;
    landingPath?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
    tenantId?: string;
  },
): Promise<void> {
  const captured = await captureReferralFromCodeString(admin, input);
  if (!captured) return;
  await setReferralCookie(captured.code);
}

export async function applyStoredReferralAttribution(
  admin: Admin,
  input: {
    tenantId: string;
    refereeCustomerId: string;
  },
): Promise<void> {
  const code = await readReferralCookie();
  if (!code) return;

  const result = await attributeRefereeFromReferralCode(admin, {
    tenantId: input.tenantId,
    refereeCustomerId: input.refereeCustomerId,
    rawReferralCode: code,
  });

  if (result.ok || result.skipped) {
    await clearReferralCookie();
  }
}
