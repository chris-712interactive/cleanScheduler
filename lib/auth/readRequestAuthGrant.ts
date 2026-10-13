import { cache } from 'react';
import { headers } from 'next/headers';
import { sessionIdFromAccessToken } from '@/lib/auth/accessTokenAmr';
import {
  AUTH_GRANT_HEADER,
  verifyRequestAuthGrant,
  type RequestAuthGrant,
} from '@/lib/auth/requestAuthGrant';
import { serverEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

async function loadRequestAuthGrant(): Promise<RequestAuthGrant | null> {
  const requestHeaders = await headers();
  const token = requestHeaders.get(AUTH_GRANT_HEADER);
  if (!token) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const sessionId = sessionIdFromAccessToken(data.session?.access_token);
  if (!sessionId) return null;

  return verifyRequestAuthGrant(token, serverEnv.SUPABASE_SERVICE_ROLE_KEY, sessionId);
}

/**
 * Proxy-signed auth snapshot for this request.
 * Null when the header is missing, expired, or bound to a different session —
 * callers then fall back to a live Auth lookup.
 */
export const readRequestAuthGrant = cache(loadRequestAuthGrant);
