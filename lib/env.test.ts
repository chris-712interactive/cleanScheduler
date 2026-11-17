import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUIRED = {
  NEXT_PUBLIC_APP_ENV: 'local',
  NEXT_PUBLIC_APP_DOMAIN: 'lvh.me:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
} as const;

const TOUCHED = [...Object.keys(REQUIRED), 'NEXT_PUBLIC_SENTRY_DSN', 'RESEND_FROM_EMAIL'] as const;

const previous = new Map<string, string | undefined>();

beforeEach(() => {
  previous.clear();
  for (const key of TOUCHED) previous.set(key, process.env[key]);
  Object.assign(process.env, REQUIRED);
});

afterEach(() => {
  for (const key of TOUCHED) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function loadEnv() {
  vi.resetModules();
  return import('./env');
}

describe('blank optional env assignments', () => {
  it('treats empty Sentry DSN and Resend from-address as unset', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = '';
    process.env.RESEND_FROM_EMAIL = '';

    const { publicEnv, serverEnv } = await loadEnv();

    expect(publicEnv.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(serverEnv.RESEND_FROM_EMAIL).toBeUndefined();
  });

  it('keeps a real Sentry DSN and Resend from-address', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    process.env.RESEND_FROM_EMAIL = 'quotes@example.com';

    const { publicEnv, serverEnv } = await loadEnv();

    expect(publicEnv.NEXT_PUBLIC_SENTRY_DSN).toBe('https://example.ingest.sentry.io/1');
    expect(serverEnv.RESEND_FROM_EMAIL).toBe('quotes@example.com');
  });

  it('rejects a non-empty Sentry DSN that is not a URL', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'not-a-url';
    delete process.env.RESEND_FROM_EMAIL;

    const { publicEnv } = await loadEnv();

    expect(() => publicEnv.NEXT_PUBLIC_SENTRY_DSN).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
  });
});
