import { describe, expect, it } from 'vitest';
import { assertHttpsDevUrl, isAllowedDevHostname } from '@/lib/hosted-dev/hostedDevUrl';

describe('hosted dev host allowlist', () => {
  it('allows the apex and one subdomain label', () => {
    expect(isAllowedDevHostname('dev.cleanscheduler.com')).toBe(true);
    expect(isAllowedDevHostname('admin.dev.cleanscheduler.com')).toBe(true);
    expect(isAllowedDevHostname('my.dev.cleanscheduler.com')).toBe(true);
    expect(isAllowedDevHostname('qa-hosted-dev-absent.dev.cleanscheduler.com')).toBe(true);
  });

  it('rejects production, preview, and nested hosts', () => {
    expect(isAllowedDevHostname('cleanscheduler.com')).toBe(false);
    expect(isAllowedDevHostname('www.cleanscheduler.com')).toBe(false);
    expect(isAllowedDevHostname('admin.cleanscheduler.com')).toBe(false);
    expect(isAllowedDevHostname('dev.cleanscheduler.com.evil.com')).toBe(false);
    expect(isAllowedDevHostname('evil.dev.cleanscheduler.com.evil.com')).toBe(false);
    expect(isAllowedDevHostname('a.b.dev.cleanscheduler.com')).toBe(false);
    expect(isAllowedDevHostname('clean-scheduler.vercel.app')).toBe(false);
    expect(isAllowedDevHostname('localhost')).toBe(false);
  });

  it('accepts only https URLs on the allowlist', () => {
    expect(assertHttpsDevUrl('https://dev.cleanscheduler.com/sign-in').hostname).toBe(
      'dev.cleanscheduler.com',
    );
    expect(() => assertHttpsDevUrl('http://dev.cleanscheduler.com')).toThrow(/https/);
    expect(() => assertHttpsDevUrl('https://user:pass@dev.cleanscheduler.com')).toThrow(
      /credentials/,
    );
    expect(() => assertHttpsDevUrl('https://dev.cleanscheduler.com:8443')).toThrow(/port/);
    expect(() => assertHttpsDevUrl('https://cleanscheduler.com')).toThrow(/outside/);
  });
});
