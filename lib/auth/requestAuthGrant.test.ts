import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  issueRequestAuthGrant,
  userFromGrant,
  verifyRequestAuthGrant,
  type RequestAuthGrantTenant,
} from '@/lib/auth/requestAuthGrant';

const SECRET = 'test-secret';

function tokenWithClaims(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `header.${payload}.sig`;
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    email: 'owner@example.com',
    app_metadata: { app_role: 'employee', current_tenant_id: 'tenant-1' },
    user_metadata: { display_name: 'Ada', first_name: 'Ada' },
    factors: [
      {
        id: 'factor-1',
        factor_type: 'totp',
        status: 'verified',
        created_at: '',
        updated_at: '',
      },
    ],
    ...overrides,
  };
}

const tenant: RequestAuthGrantTenant = {
  tenantId: 'tenant-1',
  tenantSlug: 'sparkle',
  tenantName: 'Sparkle',
  role: 'owner',
  roleId: null,
  adminSuspended: false,
  connectStatus: null,
  tenantIsActive: true,
  billingStatus: 'active',
  trialEndsAt: null,
  activatedAt: '2026-01-01T00:00:00Z',
  canceledAt: null,
  stripeSubscriptionId: 'sub_123',
};

function accessToken(): string {
  return tokenWithClaims({
    session_id: '11111111-1111-4111-8111-111111111111',
    aal: 'aal2',
    amr: [{ method: 'password' }, { method: 'totp' }],
  });
}

describe('request auth grant', () => {
  it('round-trips a signed snapshot bound to the session', () => {
    const issued = issueRequestAuthGrant({
      user: user(),
      accessToken: accessToken(),
      tenant,
      secret: SECRET,
      nowSeconds: 1_700_000_000,
    });
    expect(issued).toEqual(expect.any(String));

    const grant = verifyRequestAuthGrant(
      issued!,
      SECRET,
      '11111111-1111-4111-8111-111111111111',
      1_700_000_010,
    );
    expect(grant?.uid).toBe('user-1');
    expect(grant?.email).toBe('owner@example.com');
    expect(grant?.aal).toBe('aal2');
    expect(grant?.amr).toEqual(['password', 'totp']);
    expect(grant?.factors).toEqual([{ id: 'factor-1', factorType: 'totp', status: 'verified' }]);
    expect(grant?.tenant?.tenantSlug).toBe('sparkle');
    expect(grant?.userMetadata).toEqual({ display_name: 'Ada', first_name: 'Ada' });

    const restored = userFromGrant(grant!);
    expect(restored.app_metadata).toEqual({
      app_role: 'employee',
      current_tenant_id: 'tenant-1',
    });
    expect(restored.factors?.[0]?.factor_type).toBe('totp');
  });

  it('rejects a tampered body, a wrong session, and an expired grant', () => {
    const issued = issueRequestAuthGrant({
      user: user(),
      accessToken: accessToken(),
      tenant: null,
      secret: SECRET,
      nowSeconds: 1_700_000_000,
    });
    expect(issued).toBeTruthy();
    const [body, signature] = issued!.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ v: 1 }), 'utf8').toString('base64url')}.${signature}`;

    expect(
      verifyRequestAuthGrant(tampered, SECRET, '11111111-1111-4111-8111-111111111111'),
    ).toBeNull();
    expect(
      verifyRequestAuthGrant(
        `${body}.${signature}`,
        SECRET,
        '22222222-2222-4222-8222-222222222222',
        1_700_000_010,
      ),
    ).toBeNull();
    expect(
      verifyRequestAuthGrant(
        issued!,
        SECRET,
        '11111111-1111-4111-8111-111111111111',
        1_700_000_000 + 61,
      ),
    ).toBeNull();
  });

  it('skips issuance when the access token has no session id or the snapshot is huge', () => {
    expect(
      issueRequestAuthGrant({
        user: user(),
        accessToken: tokenWithClaims({ aal: 'aal1' }),
        tenant: null,
        secret: SECRET,
      }),
    ).toBeNull();

    const huge = user({
      user_metadata: { blob: 'x'.repeat(12_000) },
    });
    expect(
      issueRequestAuthGrant({
        user: huge,
        accessToken: accessToken(),
        tenant,
        secret: SECRET,
      }),
    ).toBeNull();
  });
});
