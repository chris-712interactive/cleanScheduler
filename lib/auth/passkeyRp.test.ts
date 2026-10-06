import { describe, expect, it, beforeAll } from 'vitest';
import { passkeyContextForOrigin, passkeyRpIdForHost } from '@/lib/auth/passkeyRp';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
  process.env.NEXT_PUBLIC_APP_DOMAIN = 'cleanscheduler.com';
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
});

describe('passkey relying party', () => {
  it('covers the apex and every tenant subdomain', () => {
    expect(passkeyRpIdForHost('cleanscheduler.com')).toBe('cleanscheduler.com');
    expect(passkeyRpIdForHost('acme.cleanscheduler.com')).toBe('cleanscheduler.com');
    expect(passkeyRpIdForHost('my.cleanscheduler.com')).toBe('cleanscheduler.com');
    expect(passkeyContextForOrigin('https://field.cleanscheduler.com')).toEqual({
      origin: 'https://field.cleanscheduler.com',
      rpId: 'cleanscheduler.com',
    });
  });

  it('rejects a white-label domain and insecure hosts', () => {
    expect(passkeyRpIdForHost('portal.theircompany.com')).toBeNull();
    expect(passkeyContextForOrigin('https://portal.theircompany.com')).toBeNull();
    expect(passkeyContextForOrigin('http://acme.cleanscheduler.com')).toBeNull();
  });

  it('allows localhost for local development', () => {
    expect(passkeyContextForOrigin('http://localhost:3000')).toEqual({
      origin: 'http://localhost:3000',
      rpId: 'localhost',
    });
  });
});
