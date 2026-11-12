import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MASQUERADE_HANDOFF_PATH,
  SUPPORT_SESSION_FUTURE_SKEW_MS,
  SUPPORT_SESSION_TTL_MS,
  createMasqueradeHandoffToken,
  hashMasqueradeHandoffToken,
  isPlatformAdminAppMetadata,
  masqueradeHandoffRedirect,
  redeemMasqueradeHandoff,
  supportSessionIsLive,
  type MasqueradeHandoffDeps,
  type StoredHandoff,
  type SupportSessionClock,
} from '@/lib/auth/masqueradeHandoff';

const NOW = Date.parse('2026-11-12T15:00:00.000Z');
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const STAFF = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const HANDOFF = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'handoff-token-value';

function session(overrides: Partial<SupportSessionClock> = {}): SupportSessionClock {
  return {
    id: SESSION,
    adminUserId: STAFF,
    targetTenantId: TENANT_A,
    startedAtMs: NOW - 5 * 60 * 1000,
    endedAtMs: null,
    ...overrides,
  };
}

function handoff(overrides: Partial<StoredHandoff> = {}): StoredHandoff {
  return {
    id: HANDOFF,
    tokenHash: hashMasqueradeHandoffToken(TOKEN),
    adminUserId: STAFF,
    targetTenantId: TENANT_A,
    masqueradeSessionId: SESSION,
    expiresAtMs: NOW + 30_000,
    usedAtMs: null,
    ...overrides,
  };
}

function deps(overrides: Partial<MasqueradeHandoffDeps> = {}): MasqueradeHandoffDeps & {
  calls: string[];
  audits: unknown[];
} {
  const calls: string[] = [];
  const audits: unknown[] = [];
  return {
    calls,
    audits,
    findHandoffByHash: async (hash) => {
      calls.push(`find:${hash}`);
      return hash === hashMasqueradeHandoffToken(TOKEN) ? handoff() : null;
    },
    findSession: async () => session(),
    loadUser: async () => ({
      appMetadata: { app_role: 'admin' },
      userMetadata: { app_role: 'customer' },
      email: 'staff@example.com',
    }),
    markUsed: async () => {
      calls.push('mark');
      return true;
    },
    establishSession: async (email) => {
      calls.push(`session:${email}`);
      return true;
    },
    audit: async (event) => {
      calls.push('audit');
      audits.push(event);
    },
    ...overrides,
  };
}

describe('supportSessionIsLive', () => {
  const expected = { userId: STAFF, tenantId: TENANT_A, nowMs: NOW };

  it('accepts an open session inside the hour, including the exact boundary and 60s skew', () => {
    expect(supportSessionIsLive(session(), expected)).toBe(true);
    expect(
      supportSessionIsLive(session({ startedAtMs: NOW - SUPPORT_SESSION_TTL_MS }), expected),
    ).toBe(true);
    expect(
      supportSessionIsLive(
        session({ startedAtMs: NOW + SUPPORT_SESSION_FUTURE_SKEW_MS }),
        expected,
      ),
    ).toBe(true);
  });

  it('rejects ended, expired, far-future, and other-tenant sessions', () => {
    expect(supportSessionIsLive(session({ endedAtMs: NOW }), expected)).toBe(false);
    expect(
      supportSessionIsLive(session({ startedAtMs: NOW - SUPPORT_SESSION_TTL_MS - 1 }), expected),
    ).toBe(false);
    expect(
      supportSessionIsLive(
        session({ startedAtMs: NOW + SUPPORT_SESSION_FUTURE_SKEW_MS + 1 }),
        expected,
      ),
    ).toBe(false);
    expect(supportSessionIsLive(session({ targetTenantId: TENANT_B }), expected)).toBe(false);
    expect(supportSessionIsLive(null, expected)).toBe(false);
  });
});

describe('isPlatformAdminAppMetadata', () => {
  it('reads only app_metadata.app_role', () => {
    expect(isPlatformAdminAppMetadata({ app_role: 'admin' })).toBe(true);
    expect(isPlatformAdminAppMetadata({ app_role: 'super_admin' })).toBe(true);
    expect(isPlatformAdminAppMetadata({ app_role: 'sales' })).toBe(false);
    expect(isPlatformAdminAppMetadata({ app_role: 'employee' })).toBe(false);
    expect(isPlatformAdminAppMetadata(null)).toBe(false);
  });
});

describe('masquerade handoff token', () => {
  it('stores a hash, not the token, and puts the token in the redirect once', () => {
    const token = createMasqueradeHandoffToken();
    const hash = hashMasqueradeHandoffToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    const url = masqueradeHandoffRedirect('http://acme.lvh.me:3000', token);
    expect(url).toBe(`http://acme.lvh.me:3000${MASQUERADE_HANDOFF_PATH}?handoff=${token}`);
    expect(url.split(token)).toHaveLength(2);
  });
});

describe('redeemMasqueradeHandoff', () => {
  it('redeems a valid token, establishes the session, and audits without the token', async () => {
    const fake = deps();
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: true });
    expect(fake.calls).toEqual([
      `find:${hashMasqueradeHandoffToken(TOKEN)}`,
      'mark',
      'session:staff@example.com',
      'audit',
    ]);
    expect(JSON.stringify(fake.audits)).not.toContain(TOKEN);
    expect(fake.audits).toEqual([
      {
        actorUserId: STAFF,
        targetTenantId: TENANT_A,
        masqueradeSessionId: SESSION,
      },
    ]);
  });

  it('rejects a reused token before establishing a session', async () => {
    const fake = deps({
      findHandoffByHash: async () => handoff({ usedAtMs: NOW - 1000 }),
    });
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: false, reason: 'reused' });
    expect(fake.calls).not.toContain('mark');
    expect(fake.calls.some((call) => call.startsWith('session:'))).toBe(false);
  });

  it('rejects an expired token', async () => {
    const fake = deps({
      findHandoffByHash: async () => handoff({ expiresAtMs: NOW }),
    });
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: false, reason: 'expired' });
    expect(fake.calls).not.toContain('mark');
  });

  it('rejects a token presented on the wrong tenant host', async () => {
    const fake = deps();
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_B, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: false, reason: 'wrong_tenant' });
    expect(fake.calls).not.toContain('mark');
  });

  it('rejects when the support session ended before redeem', async () => {
    const fake = deps({
      findSession: async () => session({ endedAtMs: NOW - 1000 }),
    });
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: false, reason: 'session_ended' });
    expect(fake.calls).not.toContain('mark');
  });

  it('rejects a user who is not platform staff in app_metadata', async () => {
    const fake = deps({
      loadUser: async () => ({
        appMetadata: { app_role: 'employee' },
        userMetadata: { app_role: 'super_admin' },
        email: 'member@example.com',
      }),
    });
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: false, reason: 'not_staff' });
    expect(fake.calls).not.toContain('mark');
    expect(fake.calls.some((call) => call.startsWith('session:'))).toBe(false);
  });

  it('still succeeds when the audit write fails after the session is established', async () => {
    const fake = deps({
      audit: async () => {
        throw new Error('audit down');
      },
    });
    const result = await redeemMasqueradeHandoff(
      { token: TOKEN, hostTenantId: TENANT_A, nowMs: NOW },
      fake,
    );
    expect(result).toEqual({ ok: true });
  });
});

describe('masquerade handoff wiring', () => {
  it('keeps the tenant handoff path public to the proxy and host-only', () => {
    const proxy = readFileSync(resolve(process.cwd(), 'proxy.ts'), 'utf8');
    expect(proxy).toContain(`requestedPath === '${MASQUERADE_HANDOFF_PATH}'`);
    expect(proxy).toContain('!isMasqueradeHandoff');
    const route = readFileSync(
      resolve(process.cwd(), 'app/tenant/auth/masquerade-handoff/route.ts'),
      'utf8',
    );
    expect(route).toContain('delete rest.domain');
    expect(route).toContain("url.searchParams.delete('handoff')");
    expect(route).not.toContain('console.');
    const action = readFileSync(resolve(process.cwd(), 'lib/admin/masqueradeActions.ts'), 'utf8');
    expect(action).toContain('masqueradeHandoffRedirect');
    expect(action).toContain('hashMasqueradeHandoffToken');
    expect(action).not.toContain('domain:');
  });
});
