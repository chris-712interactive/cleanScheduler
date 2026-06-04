import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  attributeRefereeFromReferralCode,
  captureReferralFromCodeString,
} from '@/lib/referrals/referralAttribution';
import { REFERRAL_COOKIE_NAME } from '@/lib/referrals/referralTypes';
import { normalizeReferralCode } from '@/lib/referrals/normalizeReferralCode';

type Admin = SupabaseClient<Database>;

export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function normalizedReferralCodeFromParam(raw: string | null | undefined): string | null {
  const code = normalizeReferralCode(raw ?? '');
  return code.length >= 4 ? code : null;
}

/** Cookie options for proxy redirects and server actions (not RSC render). */
export function referralCookieWriteOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  };
}

export function applyReferralCookieToResponse(
  response: NextResponse,
  rawRef: string | null | undefined,
): void {
  const code = normalizedReferralCodeFromParam(rawRef);
  if (!code) return;
  response.cookies.set(REFERRAL_COOKIE_NAME, code, referralCookieWriteOptions());
}

export async function setReferralCookie(code: string): Promise<void> {
  const normalized = normalizedReferralCodeFromParam(code);
  if (!normalized) return;
  const jar = await cookies();
  jar.set(REFERRAL_COOKIE_NAME, normalized, referralCookieWriteOptions());
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

/** Records a referral touch in the database. Cookie is set in proxy middleware. */
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
  await captureReferralFromCodeString(admin, input);
}

export async function applyStoredReferralAttribution(
  admin: Admin,
  input: {
    tenantId: string;
    refereeCustomerId: string;
  },
): Promise<{ applied: boolean; skipped: boolean }> {
  const code = await readReferralCookie();
  if (!code) return { applied: false, skipped: false };

  const result = await attributeRefereeFromReferralCode(admin, {
    tenantId: input.tenantId,
    refereeCustomerId: input.refereeCustomerId,
    rawReferralCode: code,
  });

  if (result.ok) {
    return { applied: true, skipped: false };
  }

  return { applied: false, skipped: Boolean(result.skipped) };
}
