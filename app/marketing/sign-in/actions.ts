'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { needsMfaChallenge } from '@/lib/auth/mfa';
import { parseAllowedAuthRedirectOrigin } from '@/lib/auth/whiteLabelRedirectOrigin';
import { createClient } from '@/lib/supabase/server';

export interface SignInState {
  error?: string;
  success?: string;
}

function getOriginFromHeaders(h: Headers): string {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'http';

  if (!host) {
    return 'http://lvh.me:3000';
  }

  return `${protocol}://${host}`;
}

async function resolveRedirectOrigin(formData: FormData): Promise<string> {
  const h = await headers();
  const headerOrigin = getOriginFromHeaders(h);
  const clientOrigin = await parseAllowedAuthRedirectOrigin(
    String(formData.get('return_origin') ?? ''),
  );
  if (clientOrigin) return clientOrigin;

  const headerAllowed = await parseAllowedAuthRedirectOrigin(headerOrigin);
  return headerAllowed ?? headerOrigin;
}

function normalizeNextFromForm(formData: FormData): string {
  return sanitizeAuthenticationNext(String(formData.get('next') ?? '/'));
}

export async function signInWithPassword(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const nextPath = normalizeNextFromForm(formData);

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (await needsMfaChallenge()) {
    redirect(`/sign-in/mfa?next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const nextPath = normalizeNextFromForm(formData);
  const origin = await resolveRedirectOrigin(formData);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    redirect(
      `/sign-in?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect(
    `/sign-in?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent('Google sign-in failed.')}`,
  );
}
