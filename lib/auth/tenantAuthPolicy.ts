export const MFA_METHODS = ['totp', 'passkey'] as const;

export type MfaMethod = (typeof MFA_METHODS)[number];

export type TenantAuthPolicy = {
  allowPasskeySignIn: boolean;
  mfaRequired: boolean;
  mfaAllowedMethods: MfaMethod[];
};

export const DEFAULT_TENANT_AUTH_POLICY: TenantAuthPolicy = {
  allowPasskeySignIn: true,
  mfaRequired: false,
  mfaAllowedMethods: ['totp', 'passkey'],
};

export type SessionFactors = {
  /** AMR method names from the current access token (`password`, `passkey`, …). */
  amrMethods: string[];
  authenticatorVerifiedThisSession: boolean;
  authenticatorEnrolled: boolean;
  passkeyEnrolled: boolean;
};

export type WorkspaceAuthDecision =
  | { kind: 'allow' }
  | { kind: 'passkey_disabled' }
  | { kind: 'enroll'; methods: MfaMethod[] }
  | { kind: 'verify'; methods: MfaMethod[] };

const PASSKEY_AMR_METHODS = new Set(['passkey', 'webauthn']);

export function isMfaMethod(value: string): value is MfaMethod {
  return value === 'totp' || value === 'passkey';
}

export function sessionUsedPasskey(amrMethods: readonly string[]): boolean {
  return amrMethods.some((method) => PASSKEY_AMR_METHODS.has(method));
}

export function parseMfaAllowedMethods(values: readonly string[]): MfaMethod[] {
  const unique: MfaMethod[] = [];
  for (const value of values) {
    if (!isMfaMethod(value) || unique.includes(value)) continue;
    unique.push(value);
  }
  return unique;
}

export function tenantAuthPolicyFromRow(
  row: {
    allow_passkey_sign_in: boolean | null;
    mfa_required: boolean | null;
    mfa_allowed_methods: string[] | null;
  } | null,
): TenantAuthPolicy {
  if (!row) return DEFAULT_TENANT_AUTH_POLICY;
  const methods = parseMfaAllowedMethods(row.mfa_allowed_methods ?? []);
  return {
    allowPasskeySignIn: row.allow_passkey_sign_in !== false,
    mfaRequired: row.mfa_required === true,
    mfaAllowedMethods: methods.length > 0 ? methods : DEFAULT_TENANT_AUTH_POLICY.mfaAllowedMethods,
  };
}

/**
 * Whether this session may use the workspace.
 *
 * A passkey replaces the password when the member has registered one and the
 * workspace allows it. Required 2FA is satisfied by any one allowed method
 * verified in this session: an authenticator code (AAL2) or a passkey sign-in.
 * When the workspace does not require 2FA, an enrolled authenticator app still
 * challenges password and Google sign-in.
 */
export function decideWorkspaceAuth(
  policy: TenantAuthPolicy,
  session: SessionFactors,
): WorkspaceAuthDecision {
  const usedPasskey = sessionUsedPasskey(session.amrMethods);
  if (usedPasskey && !policy.allowPasskeySignIn) {
    return { kind: 'passkey_disabled' };
  }

  const passkeySatisfied = usedPasskey;
  const totpSatisfied = session.authenticatorVerifiedThisSession;

  if (policy.mfaRequired) {
    const allowed = policy.mfaAllowedMethods;
    const satisfied =
      (allowed.includes('totp') && totpSatisfied) ||
      (allowed.includes('passkey') && passkeySatisfied);
    if (satisfied) return { kind: 'allow' };

    const verify: MfaMethod[] = [];
    if (allowed.includes('totp') && session.authenticatorEnrolled) verify.push('totp');
    if (allowed.includes('passkey') && session.passkeyEnrolled) verify.push('passkey');
    if (verify.length > 0) return { kind: 'verify', methods: verify };
    return { kind: 'enroll', methods: [...allowed] };
  }

  if (session.authenticatorEnrolled && !totpSatisfied && !usedPasskey) {
    return { kind: 'verify', methods: ['totp'] };
  }

  return { kind: 'allow' };
}

/** True when we must ask Auth whether this user has a passkey registered. */
export function workspaceAuthNeedsPasskeyInventory(
  policy: TenantAuthPolicy,
  amrMethods: readonly string[],
): boolean {
  if (!policy.mfaRequired) return false;
  if (!policy.mfaAllowedMethods.includes('passkey')) return false;
  if (sessionUsedPasskey(amrMethods)) return false;
  return true;
}

export function mfaMethodLabel(method: MfaMethod): string {
  return method === 'totp' ? 'authenticator app' : 'passkey';
}
