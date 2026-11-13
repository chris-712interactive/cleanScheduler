import { afterEach, describe, expect, it, vi } from 'vitest';
import { postTenantWebhook } from '@/lib/integrations/emitTenantWebhook';
import { sendCampaignEmail } from '@/lib/email/sendCampaignEmail';
import { sendTransactionalEmail } from '@/lib/email/resend';
import { getPlaidClient } from '@/lib/plaid/server';
import { getSentDmClient } from '@/lib/sms/sentDmServer';
import { getStripe } from '@/lib/stripe/server';
import { isProductionOutboundHost, readOutboundSuppression } from '@/lib/outbound/suppression';

const devEnv = {
  OUTBOUND_SUPPRESSED: '1',
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_APP_DOMAIN: 'dev.cleanscheduler.com',
};

describe('outbound suppression', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function enableDevSuppression(): void {
    vi.stubEnv('OUTBOUND_SUPPRESSED', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'dev.cleanscheduler.com');
  }

  it('reads only the process flag and refuses production', () => {
    expect(isProductionOutboundHost('cleanscheduler.com')).toBe(true);
    expect(isProductionOutboundHost('www.cleanscheduler.com')).toBe(true);
    expect(isProductionOutboundHost('admin.cleanscheduler.com')).toBe(true);
    expect(isProductionOutboundHost('dev.cleanscheduler.com')).toBe(false);
    expect(isProductionOutboundHost('qa.dev.cleanscheduler.com')).toBe(false);
    expect(
      readOutboundSuppression({
        ...devEnv,
        cookie: 'OUTBOUND_SUPPRESSED=1',
        'x-outbound-suppressed': '1',
        user_metadata: 'OUTBOUND_SUPPRESSED=1',
      }),
    ).toBe(true);
    expect(readOutboundSuppression({ ...devEnv, OUTBOUND_SUPPRESSED: 'true' })).toBe(false);
    expect(() =>
      readOutboundSuppression({
        OUTBOUND_SUPPRESSED: '1',
        VERCEL_ENV: 'preview',
        NEXT_PUBLIC_APP_DOMAIN: 'cleanscheduler.com',
      }),
    ).toThrow(/cleanscheduler\.com/);
    expect(() =>
      readOutboundSuppression({ OUTBOUND_SUPPRESSED: '1', VERCEL_ENV: 'production' }),
    ).toThrow(/VERCEL_ENV=production/);
    expect(() =>
      readOutboundSuppression({ OUTBOUND_SUPPRESSED: '1', VERCEL_ENV: 'Production' }),
    ).toThrow(/VERCEL_ENV=production/);
    expect(() =>
      readOutboundSuppression({
        OUTBOUND_SUPPRESSED: '1',
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_DOMAIN: 'localhost',
      }),
    ).toThrow(/NODE_ENV=production/);
    expect(
      readOutboundSuppression({
        OUTBOUND_SUPPRESSED: '1',
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        NEXT_PUBLIC_APP_DOMAIN: 'dev.cleanscheduler.com',
      }),
    ).toBe(true);
  });

  it('short-circuits Stripe, Plaid, sent.dm, Resend, and webhooks before fetch', async () => {
    enableDevSuppression();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const stripe = getStripe();
    expect(stripe).not.toBeNull();
    await expect(stripe!.refunds.create({ charge: 'ch_secret' })).rejects.toThrow(/turned off/);
    const session = await stripe!.checkout.sessions.create({ mode: 'payment' });
    const customers = await stripe!.customers.list({ email: 'person@example.com', limit: 1 });
    expect(session.url).toBeNull();
    expect(customers.data).toEqual([]);
    expect(() => stripe!.webhooks.constructEvent('{}', 'sig', 'whsec_secret')).toThrow(/refused/);

    const plaid = getPlaidClient();
    const link = await plaid.linkTokenCreate({} as never);
    const exchange = await plaid.itemPublicTokenExchange({ public_token: 'public-secret' });
    expect(link.data.link_token).toMatch(/^suppressed_plaid_linktokencreate_/);
    expect(exchange.data.access_token).toMatch(/^suppressed_plaid_access_/);
    const sync = await plaid.transactionsSync({ access_token: 'access-secret' });
    expect(sync.data.has_more).toBe(false);
    expect(sync.data.added).toEqual([]);

    const sent = getSentDmClient();
    const sms = await sent.messages.send({ to: ['+15555550123'], text: 'secret body' });
    expect(sms.success).toBe(true);
    expect(sms.data?.recipients?.[0]?.message_id).toMatch(/^suppressed_sentdm_message_/);

    const email = await sendTransactionalEmail({
      to: 'person@example.com',
      subject: 'Hello person@example.com',
      text: 'secret',
      html: '<p>secret</p>',
    });
    expect(email.ok).toBe(false);
    const campaign = await sendCampaignEmail({
      to: 'person@example.com',
      from: 'Clean Scheduler <news@example.com>',
      subject: 'Hi',
      text: 'secret',
      html: '<p>secret</p>',
      tags: [],
    });
    expect(campaign.ok).toBe(false);

    const webhook = await postTenantWebhook(
      'https://hooks.example/path?email=person@example.com',
      '{"to":"person@example.com","secret":"whsec"}',
      'v1=signature',
    );
    expect(webhook.status).toBe(503);
    expect(webhook.ok).toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
    const logged = info.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('provider=stripe');
    expect(logged).toContain('provider=plaid');
    expect(logged).toContain('provider=sentdm');
    expect(logged).toContain('provider=resend');
    expect(logged).toContain('provider=webhook');
    expect(logged).not.toContain('person@example.com');
    expect(logged).not.toContain('ch_secret');
    expect(logged).not.toContain('public-secret');
    expect(logged).not.toContain('whsec');
    expect(logged).not.toContain('hooks.example');
    expect(logged).not.toContain('+15555550123');
  });

  it('does not suppress when the flag is off', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    vi.stubEnv('OUTBOUND_SUPPRESSED', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'cleanscheduler.com');
    expect(readOutboundSuppression(process.env)).toBe(false);
    expect(getStripe()).toBeNull();
  });
});
