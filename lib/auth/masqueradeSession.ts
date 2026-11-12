/** Support entry stays open for one hour from `masquerade_sessions.started_at`. */
export const MASQUERADE_MAX_DURATION_MS = 60 * 60 * 1000;

/** Row shape used to decide whether a support session is still open. */
export type MasqueradeSessionClock = {
  admin_user_id: string;
  target_tenant_id: string;
  started_at: string | null;
  ended_at: string | null;
};

/**
 * A masquerade admits only when this staff user has an open row for the target
 * tenant and that row is still inside the one-hour TTL. `app_metadata` alone
 * is not a session.
 */
export function liveMasqueradeSessionMatches(
  session: MasqueradeSessionClock | null | undefined,
  expected: { userId: string; tenantId: string; nowMs: number },
): boolean {
  if (!session) return false;
  if (session.ended_at) return false;
  if (session.admin_user_id !== expected.userId) return false;
  if (session.target_tenant_id !== expected.tenantId) return false;
  if (!session.started_at) return false;
  const started = new Date(session.started_at).getTime();
  if (!Number.isFinite(started)) return false;
  return expected.nowMs - started <= MASQUERADE_MAX_DURATION_MS;
}
