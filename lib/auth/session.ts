import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { extractClaims, type AuthContext } from './types';

async function loadAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    user: data.user,
    claims: extractClaims(data.user),
  };
}

/**
 * Returns the current authenticated user context, or null when no active
 * Supabase session exists. Cached per request so layout + page do not double-fetch.
 */
export const getAuthContext = cache(loadAuthContext);

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
