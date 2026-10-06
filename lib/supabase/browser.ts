/**
 * Supabase client for the browser bundle (client components, hooks).
 *
 * Reads the public anon key only - never wire the service-role key into a
 * client component. RLS will enforce tenant isolation on every query.
 */
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
