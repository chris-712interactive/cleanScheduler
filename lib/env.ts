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
 *   - Cross-env Stripe: prod requires sk_live_; non-prod must not use sk_live_
 *     (see getServerEnv()).
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
  /** @deprecated Use tier-specific prices; used as fallback when a tier id is unset. */
  STRIPE_PLATFORM_PRICE_ID: z.string().optional(),
  /** Stripe recurring Price IDs — cleanScheduler platform subscription per tier. */
  STRIPE_PLATFORM_PRICE_STARTER: z.string().optional(),
  STRIPE_PLATFORM_PRICE_PRO: z.string().optional(),
  STRIPE_PLATFORM_PRICE_BUSINESS: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  /** Optional platform fee on tenant invoice Checkout (basis points, e.g. 100 = 1%). Max 10000. */
  STRIPE_CONNECT_APPLICATION_FEE_BPS: z.string().optional(),
  /** Optional Stripe Billing Portal configuration id for Connect customer portal sessions. */
  STRIPE_CONNECT_BILLING_PORTAL_CONFIGURATION_ID: z.string().optional(),

  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  /** Resend — API key from https://resend.com/api-keys */
  RESEND_API_KEY: z.string().optional(),
  /** Resend — verified sender for non-template sends (e.g. quotes). Portal invite template may define its own from. */
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
  /** Resend — published template id/alias for customer portal invites (default create-customer-account). */
  RESEND_CUSTOMER_INVITE_TEMPLATE_ID: z.string().min(1).optional(),
  // onboarding create-user behavior:
  // auto     -> dev/local auto-confirm, prod requires confirmation
  // required -> always require email confirmation before first sign-in
  // disabled -> always auto-confirm on signup
  ONBOARDING_EMAIL_CONFIRM_MODE: z.enum(['auto', 'required', 'disabled']).default('auto'),
  /** Vercel Cron / manual GET `/api/cron/materialize-recurring-visits` — `Authorization: Bearer …`. */
  CRON_SECRET: z.string().optional(),
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

  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv === 'prod') {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && !stripeKey.startsWith('sk_live_')) {
      throw new Error(
        'NEXT_PUBLIC_APP_ENV=prod but STRIPE_SECRET_KEY is not a live key (expected sk_live_…).',
      );
    }
    const plaidSecret = process.env.PLAID_SECRET;
    if (plaidSecret && process.env.PLAID_ENV && process.env.PLAID_ENV !== 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_ENV=prod with PLAID_SECRET set requires PLAID_ENV=production.',
      );
    }
  } else {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey.startsWith('sk_live_')) {
      throw new Error(
        'STRIPE_SECRET_KEY is a live Stripe key (sk_live_…) but NEXT_PUBLIC_APP_ENV is not prod.',
      );
    }
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
