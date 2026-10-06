/**
 * Shared Auth client options. Passkeys are experimental in supabase-js and
 * stay off until this flag is set on every client that calls them.
 */
export const supabaseAuthOptions = {
  experimental: { passkey: true },
} as const;
