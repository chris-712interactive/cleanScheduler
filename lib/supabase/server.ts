/**
 * Supabase clients for server-side contexts (Server Components, Route
 * Handlers, Server Actions).
 *
 * Two flavors:
 *
 *   createClient()       - cookie-bound; uses the request's auth cookies so
 *                          RLS sees the authenticated user. Safe for any
 *                          tenant or customer-facing request.
 *
 *   createAdminClient()  - service-role; bypasses RLS. Reach for this only in
 *                          founder-admin tooling, webhooks, and background
 *                          jobs - never in a tenant-scoped request path.
 */
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from './database.types';
import type { CookieOptions } from '@supabase/ssr';

export async function createClient() {
  const cookieStore = await cookies();
  type CookieToSet = { name: string; value: string; options?: CookieOptions };

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method may be called from a Server Component (e.g.
            // when a Supabase auth helper refreshes the session). Server
            // Components cannot mutate cookies; the middleware will refresh
            // them on the next request, so we swallow the throw here.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS - use only from trusted server contexts
 * where bypass is the explicit intent (webhooks, founder-admin, cron jobs).
 */
export function createAdminClient() {
  return createServiceClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
