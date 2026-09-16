import { describe, expect, it } from 'vitest';
import {
  clientIpFromHeaders,
  requestFingerprintAuditFields,
  requestFingerprintFromHeaders,
} from './requestFingerprint';

describe('requestFingerprintFromHeaders', () => {
  it('prefers the first x-forwarded-for hop', () => {
    const h = new Headers({
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      'x-real-ip': '10.0.0.1',
      'user-agent': 'Mozilla/5.0 Test',
      'accept-language': 'en-US,en;q=0.9',
    });
    expect(requestFingerprintFromHeaders(h)).toEqual({
      clientIp: '203.0.113.10',
      userAgent: 'Mozilla/5.0 Test',
      acceptLanguage: 'en-US,en;q=0.9',
    });
  });

  it('falls back to x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.20' });
    expect(clientIpFromHeaders(h)).toBe('198.51.100.20');
  });

  it('maps to audit payload keys', () => {
    expect(
      requestFingerprintAuditFields({
        clientIp: '203.0.113.1',
        userAgent: 'ua',
        acceptLanguage: 'en',
      }),
    ).toEqual({
      client_ip: '203.0.113.1',
      user_agent: 'ua',
      accept_language: 'en',
    });
  });
});
