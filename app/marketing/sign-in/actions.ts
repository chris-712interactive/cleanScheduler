'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseAllowedRedirectOrigin } from '@/lib/auth/allowedRedirectOrigin';
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
  const clientOrigin = parseAllowedRedirectOrigin(String(formData.get('return_origin') ?? ''));
  return clientOrigin ?? headerOrigin;
}

function normalizeNextFromForm(formData: FormData): string {
  const raw = String(formData.get('next') ?? '/').trim();
  return raw.startsWith('/') ? raw : '/';
}

export async function requestMagicLink(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const nextPath = normalizeNextFromForm(formData);

  if (!email) {
    return { error: 'Please enter your email address.' };
  }

  const supabase = await createClient();
  const origin = await resolveRedirectOrigin(formData);
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    success:
      'Check your inbox for a secure sign-in link. Once clicked, you will be redirected back to your portal.',
  };
}

export async function signInWithPassword(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
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

  redirect(nextPath);
}

export async function signUpWithPassword(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  const nextPath = normalizeNextFromForm(formData);

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const origin = await resolveRedirectOrigin(formData);
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      'Account created. If email confirmation is enabled in Supabase, check your inbox to verify before signing in.',
  };
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

  redirect(`/sign-in?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent('Google sign-in failed.')}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
