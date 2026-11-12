import { createHash, randomBytes } from 'node:crypto';

/** Support entry stays open for one hour from `masquerade_sessions.started_at`. */
export const SUPPORT_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * `started_at` may sit this far in the future and still count as live.
 * Matches `has_live_support_session` in migration 0126. PR #246's
 * `liveMasqueradeSessionMatches` uses the same TTL and does not yet apply
 * this skew bound.
 */
export const SUPPORT_SESSION_FUTURE_SKEW_MS = 60 * 1000;

/** One-time tenant-host handoff. The URL token expires within this window. */
export const MASQUERADE_HANDOFF_TTL_MS = 60 * 1000;

export const MASQUERADE_HANDOFF_PATH = '/auth/masquerade-handoff';

export type SupportSessionClock = {
  id: string;
  adminUserId: string;
  targetTenantId: string;
  startedAtMs: number;
  endedAtMs: number | null;
};

export type StoredHandoff = {
  id: string;
  tokenHash: string;
  adminUserId: string;
  targetTenantId: string;
  masqueradeSessionId: string;
  expiresAtMs: number;
  /** Set once the token has been consumed. Any non-null value is reused. */
  usedAtMs: number | null;
};

export type HandoffStaffUser = {
  /** Auth `app_metadata` only. `user_metadata` is not a role source. */
  appMetadata: unknown;
  userMetadata: unknown;
  email: string | null;
};

export type MasqueradeHandoffDeps = {
  findHandoffByHash: (hash: string) => Promise<StoredHandoff | null>;
  findSession: (sessionId: string) => Promise<SupportSessionClock | null>;
  loadUser: (userId: string) => Promise<HandoffStaffUser | null>;
  markUsed: (id: string, usedAtIso: string) => Promise<boolean>;
  establishSession: (email: string) => Promise<boolean>;
  audit: (event: {
    actorUserId: string;
    targetTenantId: string;
    masqueradeSessionId: string;
  }) => Promise<void>;
};

export type RedeemMasqueradeHandoffResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing'
        | 'wrong_tenant'
        | 'reused'
        | 'expired'
        | 'session_ended'
        | 'session_not_live'
        | 'not_staff'
        | 'session_not_established';
    };

export function createMasqueradeHandoffToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashMasqueradeHandoffToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function masqueradeHandoffRedirect(origin: string, token: string): string {
  const url = new URL(MASQUERADE_HANDOFF_PATH, origin);
  url.searchParams.set('handoff', token);
  return url.toString();
}

/** Platform staff is Auth `app_metadata.app_role` of admin or super_admin. */
export function isPlatformAdminAppMetadata(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== 'object') return false;
  const role = (appMetadata as { app_role?: unknown }).app_role;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Open, unexpired support session for this staff user and tenant.
 * `started_at` more than 60 seconds ahead does not count. The exact one-hour
 * mark still counts.
 */
export function supportSessionIsLive(
  session: SupportSessionClock | null | undefined,
  expected: { userId: string; tenantId: string; nowMs: number },
): boolean {
  if (!session) return false;
  if (session.endedAtMs != null) return false;
  if (session.adminUserId !== expected.userId) return false;
  if (session.targetTenantId !== expected.tenantId) return false;
  if (!Number.isFinite(session.startedAtMs)) return false;
  if (session.startedAtMs > expected.nowMs + SUPPORT_SESSION_FUTURE_SKEW_MS) return false;
  return expected.nowMs - session.startedAtMs <= SUPPORT_SESSION_TTL_MS;
}

export function handoffFromRow(row: {
  id: string;
  token_hash: string;
  admin_user_id: string;
  target_tenant_id: string;
  masquerade_session_id: string;
  expires_at: string;
  used_at: string | null;
}): StoredHandoff | null {
  const expiresAtMs = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAtMs)) return null;
  const usedAtMs = row.used_at == null ? null : new Date(row.used_at).getTime();
  return {
    id: row.id,
    tokenHash: row.token_hash,
    adminUserId: row.admin_user_id,
    targetTenantId: row.target_tenant_id,
    masqueradeSessionId: row.masquerade_session_id,
    expiresAtMs,
    usedAtMs: usedAtMs == null ? null : Number.isFinite(usedAtMs) ? usedAtMs : 0,
  };
}

export function supportSessionFromRow(
  row: {
    id: string;
    admin_user_id: string;
    target_tenant_id: string;
    started_at: string | null;
    ended_at: string | null;
  } | null,
): SupportSessionClock | null {
  if (!row?.started_at) return null;
  const startedAtMs = new Date(row.started_at).getTime();
  if (!Number.isFinite(startedAtMs)) return null;
  if (row.ended_at == null) {
    return {
      id: row.id,
      adminUserId: row.admin_user_id,
      targetTenantId: row.target_tenant_id,
      startedAtMs,
      endedAtMs: null,
    };
  }
  const endedAtMs = new Date(row.ended_at).getTime();
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    targetTenantId: row.target_tenant_id,
    startedAtMs,
    endedAtMs: Number.isFinite(endedAtMs) ? endedAtMs : 0,
  };
}

/**
 * Redeem a one-time handoff. The raw token is hashed before lookup and is not
 * passed to the audit callback. A failed check does not mark the token used,
 * except a lost race on `markUsed`.
 */
export async function redeemMasqueradeHandoff(
  input: { token: string; hostTenantId: string; nowMs: number },
  deps: MasqueradeHandoffDeps,
): Promise<RedeemMasqueradeHandoffResult> {
  const token = input.token.trim();
  if (!token) return { ok: false, reason: 'missing' };

  const row = await deps.findHandoffByHash(hashMasqueradeHandoffToken(token));
  if (!row) return { ok: false, reason: 'missing' };
  if (row.targetTenantId !== input.hostTenantId) return { ok: false, reason: 'wrong_tenant' };
  if (row.usedAtMs != null) return { ok: false, reason: 'reused' };
  if (row.expiresAtMs <= input.nowMs) return { ok: false, reason: 'expired' };

  const session = await deps.findSession(row.masqueradeSessionId);
  if (session?.endedAtMs != null) return { ok: false, reason: 'session_ended' };
  if (
    !supportSessionIsLive(session, {
      userId: row.adminUserId,
      tenantId: row.targetTenantId,
      nowMs: input.nowMs,
    })
  ) {
    return { ok: false, reason: 'session_not_live' };
  }

  const user = await deps.loadUser(row.adminUserId);
  if (!user || !isPlatformAdminAppMetadata(user.appMetadata)) {
    return { ok: false, reason: 'not_staff' };
  }
  const email = user.email?.trim() ?? '';
  if (!email) return { ok: false, reason: 'session_not_established' };

  const marked = await deps.markUsed(row.id, new Date(input.nowMs).toISOString());
  if (!marked) return { ok: false, reason: 'reused' };

  const established = await deps.establishSession(email);
  if (!established) return { ok: false, reason: 'session_not_established' };

  try {
    await deps.audit({
      actorUserId: row.adminUserId,
      targetTenantId: row.targetTenantId,
      masqueradeSessionId: row.masqueradeSessionId,
    });
  } catch {
    // The token is already single-use and the tenant-host session exists.
  }

  return { ok: true };
}
