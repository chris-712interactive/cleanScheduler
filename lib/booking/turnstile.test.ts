import { describe, expect, it } from 'vitest';
import { turnstileMode, verifyTurnstileResponse } from '@/lib/booking/turnstile';

describe('turnstileMode', () => {
  it('stays off until both keys are set', () => {
    expect(turnstileMode({ siteKey: '', secret: '' })).toBe('off');
    expect(turnstileMode({ siteKey: 'site', secret: '' })).toBe('misconfigured');
    expect(turnstileMode({ siteKey: 'site', secret: 'secret' })).toBe('on');
  });
});

describe('verifyTurnstileResponse', () => {
  it('accepts a token Cloudflare marks successful', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 })) as typeof fetch;
    await expect(
      verifyTurnstileResponse({
        token: 'tok',
        secret: 'secret',
        remoteIp: '203.0.113.10',
        fetchImpl,
      }),
    ).resolves.toBe(true);
  });

  it('rejects a missing token without calling Cloudflare', async () => {
    const fetchImpl = (async () => {
      throw new Error('should not fetch');
    }) as typeof fetch;
    await expect(
      verifyTurnstileResponse({ token: '  ', secret: 'secret', fetchImpl }),
    ).resolves.toBe(false);
  });
});
