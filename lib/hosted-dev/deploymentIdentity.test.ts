import { describe, expect, it, vi } from 'vitest';
import {
  buildDeploymentIdentity,
  decideIdentity,
  loadDeploymentIdentity,
  stripePublishableMode,
} from '@/lib/hosted-dev/deploymentIdentity';

const devIdentity = {
  service: 'cleanscheduler' as const,
  appEnv: 'dev',
  appDomain: 'dev.cleanscheduler.com',
  gitSha: 'a'.repeat(40),
  gitRef: 'dev',
  deploymentId: 'dpl_example',
  vercelEnv: 'preview',
  targetEnv: 'dev',
  supabaseHost: 'devproject.supabase.co',
  stripePublishableMode: 'test' as const,
  plaidEnv: 'sandbox',
  outboundSuppressed: false,
};

describe('deployment identity', () => {
  it('reduces the publishable key to a mode', () => {
    expect(stripePublishableMode('pk_test_123')).toBe('test');
    expect(stripePublishableMode('pk_live_123')).toBe('live');
    expect(stripePublishableMode('')).toBe('unset');
    expect(stripePublishableMode('pk_other')).toBe('unknown');
  });

  it('omits secret values from the public payload', () => {
    const identity = buildDeploymentIdentity({
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_APP_DOMAIN: 'dev.cleanscheduler.com',
      NEXT_PUBLIC_SUPABASE_URL: 'https://devproject.supabase.co',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
      PLAID_ENV: 'sandbox',
      PLAID_SECRET: 'super-secret-value',
      STRIPE_SECRET_KEY: 'sk_test_abc',
      VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40),
      VERCEL_GIT_COMMIT_REF: 'dev',
      VERCEL_ENV: 'preview',
      VERCEL_TARGET_ENV: 'dev',
      VERCEL_DEPLOYMENT_ID: 'dpl_123',
    });
    expect(identity.stripePublishableMode).toBe('test');
    expect(identity.outboundSuppressed).toBe(false);
    expect(identity.supabaseHost).toBe('devproject.supabase.co');
    expect(JSON.stringify(identity)).not.toContain('super-secret-value');
    expect(JSON.stringify(identity)).not.toContain('sk_test_abc');
    expect(JSON.stringify(identity)).not.toContain('pk_test_abc');
  });

  it('accepts a dev identity and rejects production signals', () => {
    expect(
      decideIdentity({ httpStatus: 200, body: devIdentity, expectedSha: 'a'.repeat(40) }).status,
    ).toBe('ok');
    expect(decideIdentity({ httpStatus: 404, body: null }).status).toBe('missing');
    expect(
      decideIdentity({ httpStatus: 200, body: { ...devIdentity, appEnv: 'prod' } }),
    ).toMatchObject({ status: 'reject' });
    expect(
      decideIdentity({
        httpStatus: 200,
        body: { ...devIdentity, stripePublishableMode: 'live' },
      }),
    ).toMatchObject({ reason: expect.stringMatching(/live/) });
    expect(
      decideIdentity({ httpStatus: 200, body: { ...devIdentity, plaidEnv: 'production' } }),
    ).toMatchObject({ reason: expect.stringMatching(/Plaid/) });
    expect(
      decideIdentity({ httpStatus: 200, body: { ...devIdentity, gitRef: 'main' } }),
    ).toMatchObject({ reason: expect.stringMatching(/git ref/) });
    expect(
      decideIdentity({
        httpStatus: 200,
        body: { ...devIdentity, vercelEnv: 'production', targetEnv: 'dev' },
      }),
    ).toMatchObject({ reason: expect.stringMatching(/production/) });
    expect(
      decideIdentity({
        httpStatus: 200,
        body: { ...devIdentity, outboundSuppressed: true },
      }).status,
    ).toBe('ok');
    expect(
      decideIdentity({
        httpStatus: 200,
        body: { ...devIdentity, outboundSuppressed: '1' },
      }),
    ).toMatchObject({ status: 'ok', identity: { outboundSuppressed: false } });
    expect(
      decideIdentity({
        httpStatus: 200,
        body: {
          ...devIdentity,
          appEnv: 'dev',
          appDomain: 'cleanscheduler.com',
          outboundSuppressed: true,
        },
      }),
    ).toMatchObject({ reason: expect.stringMatching(/production host|not dev/) });
    expect(
      decideIdentity({ httpStatus: 200, body: { ...devIdentity, gitRef: null } }),
    ).toMatchObject({ reason: expect.stringMatching(/missing/) });
    expect(
      decideIdentity({
        httpStatus: 200,
        body: devIdentity,
        deniedSupabaseProjectRef: 'devproject',
      }),
    ).toMatchObject({ reason: expect.stringMatching(/denied/) });
  });

  it('retries a SHA mismatch and then rejects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...devIdentity, gitSha: 'c'.repeat(40) }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(devIdentity), { status: 200 }));
    const decision = await loadDeploymentIdentity({
      origin: 'https://dev.cleanscheduler.com',
      expectedSha: 'a'.repeat(40),
      fetchImpl,
      attempts: 2,
      sleepMs: 0,
    });
    expect(decision.status).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not follow an identity redirect', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    const decision = await loadDeploymentIdentity({
      origin: 'https://dev.cleanscheduler.com',
      fetchImpl,
      attempts: 1,
    });
    expect(decision).toMatchObject({
      status: 'reject',
      reason: expect.stringMatching(/redirect/i),
    });
  });
});
