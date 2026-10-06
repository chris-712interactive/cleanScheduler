import { describe, expect, it } from 'vitest';
import { amrMethodsFromAccessToken } from '@/lib/auth/accessTokenAmr';
import {
  decideWorkspaceAuth,
  DEFAULT_TENANT_AUTH_POLICY,
  parseMfaAllowedMethods,
  tenantAuthPolicyFromRow,
  type SessionFactors,
  type TenantAuthPolicy,
} from '@/lib/auth/tenantAuthPolicy';

function session(overrides: Partial<SessionFactors> = {}): SessionFactors {
  return {
    amrMethods: ['password'],
    authenticatorVerifiedThisSession: false,
    authenticatorEnrolled: false,
    passkeyEnrolled: false,
    ...overrides,
  };
}

function tokenWithAmr(amr: unknown): string {
  const payload = Buffer.from(JSON.stringify({ amr }), 'utf8').toString('base64url');
  return `header.${payload}.sig`;
}

describe('tenant auth policy', () => {
  it('parses stored methods and falls back when the row is missing', () => {
    expect(parseMfaAllowedMethods(['totp', 'sms', 'passkey', 'totp'])).toEqual(['totp', 'passkey']);
    expect(tenantAuthPolicyFromRow(null)).toEqual(DEFAULT_TENANT_AUTH_POLICY);
    expect(
      tenantAuthPolicyFromRow({
        allow_passkey_sign_in: false,
        mfa_required: true,
        mfa_allowed_methods: ['passkey'],
      }),
    ).toEqual({
      allowPasskeySignIn: false,
      mfaRequired: true,
      mfaAllowedMethods: ['passkey'],
    });
  });

  it('lets a passkey replace a password when the workspace allows it', () => {
    expect(
      decideWorkspaceAuth(DEFAULT_TENANT_AUTH_POLICY, session({ amrMethods: ['passkey'] })),
    ).toEqual({ kind: 'allow' });
  });

  it('rejects a passkey session when the workspace turns passkeys off', () => {
    expect(
      decideWorkspaceAuth(
        { ...DEFAULT_TENANT_AUTH_POLICY, allowPasskeySignIn: false },
        session({ amrMethods: ['passkey'] }),
      ),
    ).toEqual({ kind: 'passkey_disabled' });
  });

  it('requires one accepted second step and sends people to enroll or verify', () => {
    const policy: TenantAuthPolicy = {
      allowPasskeySignIn: true,
      mfaRequired: true,
      mfaAllowedMethods: ['totp', 'passkey'],
    };

    expect(decideWorkspaceAuth(policy, session())).toEqual({
      kind: 'enroll',
      methods: ['totp', 'passkey'],
    });
    expect(decideWorkspaceAuth(policy, session({ passkeyEnrolled: true }))).toEqual({
      kind: 'verify',
      methods: ['passkey'],
    });
    expect(
      decideWorkspaceAuth(policy, session({ amrMethods: ['passkey'], passkeyEnrolled: true })),
    ).toEqual({ kind: 'allow' });
    expect(
      decideWorkspaceAuth(policy, session({ authenticatorVerifiedThisSession: true })),
    ).toEqual({ kind: 'allow' });
  });

  it('still challenges an enrolled authenticator after a password sign-in', () => {
    expect(
      decideWorkspaceAuth(DEFAULT_TENANT_AUTH_POLICY, session({ authenticatorEnrolled: true })),
    ).toEqual({ kind: 'verify', methods: ['totp'] });
  });

  it('reads passkey and password methods from the access token', () => {
    expect(amrMethodsFromAccessToken(tokenWithAmr([{ method: 'passkey', timestamp: 1 }]))).toEqual([
      'passkey',
    ]);
    expect(amrMethodsFromAccessToken('not-a-jwt')).toEqual([]);
  });
});
