import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { extractClaims, type AuthContext } from './types';

/**
 * Returns the current authenticated user context, or null when no active
 * Supabase session exists.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    user: data.user,
    claims: extractClaims(data.user),
  };
}

/**
 * Enforces authentication in server components / layouts. Redirects to
 * marketing sign-in when unauthenticated.
 */
export async function requireAuth(nextPath = '/'): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (auth) return auth;

  const normalized = nextPath.startsWith('/') ? nextPath : '/';
  redirect(`/sign-in?next=${encodeURIComponent(normalized)}`);
}
