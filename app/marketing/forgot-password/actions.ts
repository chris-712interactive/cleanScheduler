'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { parseAllowedAuthRedirectOrigin } from '@/lib/auth/whiteLabelRedirectOrigin';

export interface ForgotPasswordState {
  error?: string;
  success?: string;
}

function getOriginFromHeaders(h: Headers): string {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'http';
  if (!host) return 'http://lvh.me:3000';
  return `${protocol}://${host}`;
}

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: 'Email is required.' };
  }

  const h = await headers();
  const headerOrigin = getOriginFromHeaders(h);
  const clientOrigin = await parseAllowedAuthRedirectOrigin(
    String(formData.get('return_origin') ?? ''),
  );
  const origin = clientOrigin ?? (await parseAllowedAuthRedirectOrigin(headerOrigin)) ?? headerOrigin;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      'If an account exists for that email, a reset link is on its way. Check your inbox (and spam). Branding follows Supabase email settings.',
  };
}
