/**
 * Centralised environment-variable validation.
 *
 * Per implementation plan section 16 ("Environments & deployment"):
 *
 *   - Every env var is parsed via a Zod schema on first access.
 *   - If validation fails the process throws immediately at the call site,
 *     so misconfigured environments still fail fast without causing build-time
 *     crashes for routes that import env-aware modules but are not executed.
 *   - Public (browser-shipped) vars are split from server-only vars so we
 *     can't accidentally read a server secret from a client component.
 *
 * Usage:
 *
 *   // Server (route handlers, Server Components, server actions):
 *   import { serverEnv } from '@/lib/env';
 *   serverEnv.SUPABASE_SERVICE_ROLE_KEY;
 *
 *   // Client OR server (everywhere):
 *   import { publicEnv } from '@/lib/env';
 *   publicEnv.NEXT_PUBLIC_SUPABASE_URL;
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Public (NEXT_PUBLIC_*) - safe to ship to the browser
// -----------------------------------------------------------------------------

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'dev', 'prod']),
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1, 'NEXT_PUBLIC_APP_DOMAIN must be set'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'),

  // Optional now, required as those features come online.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// Manually pluck NEXT_PUBLIC_* vars: webpack inlines them at build time, so
// `process.env.NEXT_PUBLIC_FOO` works in both server and browser bundles, but
// destructuring `process.env` does not.
let _publicEnvCache: z.infer<typeof publicEnvSchema> | undefined;

function getPublicEnv(): z.infer<typeof publicEnvSchema> {
  if (_publicEnvCache) return _publicEnvCache;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!parsed.success) {
    throw new Error(
      'Invalid public environment variables:\n' +
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
  }

  _publicEnvCache = parsed.data;
  return _publicEnvCache;
}

export const publicEnv = new Proxy({} as z.infer<typeof publicEnvSchema>, {
  get(_target, prop: string) {
    return getPublicEnv()[prop as keyof z.infer<typeof publicEnvSchema>];
  },
});

// -----------------------------------------------------------------------------
// Server-only - never reach for these from a client component
// -----------------------------------------------------------------------------

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY must be set on the server'),

  // Optional now, required when those integrations land.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),

  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
});

// We lazy-instantiate so importing this module from a client component does
// not blow up just because server-only vars are unavailable in that bundle.
let _serverEnvCache: z.infer<typeof serverEnvSchema> | undefined;

function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv accessed from a browser context. Use publicEnv for ' +
        'client-safe values.',
    );
  }

  if (_serverEnvCache) return _serverEnvCache;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      'Invalid server environment variables:\n' +
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
  }
  _serverEnvCache = parsed.data;
  return _serverEnvCache;
}

export const serverEnv = new Proxy({} as z.infer<typeof serverEnvSchema>, {
  get(_target, prop: string) {
    return getServerEnv()[prop as keyof z.infer<typeof serverEnvSchema>];
  },
});

// -----------------------------------------------------------------------------
// Convenience flags
// -----------------------------------------------------------------------------

export const isLocal = () => publicEnv.NEXT_PUBLIC_APP_ENV === 'local';
export const isDev = () => publicEnv.NEXT_PUBLIC_APP_ENV === 'dev';
export const isProd = () => publicEnv.NEXT_PUBLIC_APP_ENV === 'prod';
