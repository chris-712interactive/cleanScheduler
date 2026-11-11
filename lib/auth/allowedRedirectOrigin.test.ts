import { beforeAll, describe, expect, it } from 'vitest';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
  process.env.NEXT_PUBLIC_APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
});

describe('sanitizeAuthenticationNext', () => {
  it('keeps same-origin paths and collapses external URLs', () => {
    expect(sanitizeAuthenticationNext('/tenants')).toBe('/tenants');
    expect(sanitizeAuthenticationNext('/schedule?view=today#crew')).toBe(
      '/schedule?view=today#crew',
    );
    expect(sanitizeAuthenticationNext('//evil.example')).toBe('/');
    expect(sanitizeAuthenticationNext('https://evil.example/phish')).toBe('/');
    expect(sanitizeAuthenticationNext('http://evil.example/phish')).toBe('/');
  });

  it('collapses backslash paths browsers send to another host', () => {
    expect(sanitizeAuthenticationNext('/\\evil.example')).toBe('/');
    expect(sanitizeAuthenticationNext('/\\\\evil.example')).toBe('/');
    expect(sanitizeAuthenticationNext('/\\/evil.example')).toBe('/');
    expect(sanitizeAuthenticationNext('/\\@evil.example')).toBe('/');
    expect(sanitizeAuthenticationNext('  /\\evil.example  ')).toBe('/');
    const resolved = new URL('/\\evil.example', 'https://admin.lvh.me:3000');
    expect(resolved.origin).toBe('https://evil.example');
  });

  it('keeps an allowed absolute same-site URL', () => {
    expect(sanitizeAuthenticationNext('http://admin.lvh.me:3000/tenants')).toBe(
      'http://admin.lvh.me:3000/tenants',
    );
  });
});
