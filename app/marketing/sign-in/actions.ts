'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
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

export async function requestMagicLink(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const nextPathRaw = String(formData.get('next') ?? '/').trim();

  const nextPath = nextPathRaw.startsWith('/') ? nextPathRaw : '/';

  if (!email) {
    return { error: 'Please enter your email address.' };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = getOriginFromHeaders(h);
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

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
