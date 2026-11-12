/** Support entry stays open for one hour from `masquerade_sessions.started_at`. */
export const MASQUERADE_MAX_DURATION_MS = 60 * 60 * 1000;

/** A start slightly ahead of this server is still a live session. */
export const MASQUERADE_CLOCK_SKEW_MS = 60 * 1000;

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
  const elapsed = expected.nowMs - started;
  if (elapsed < -MASQUERADE_CLOCK_SKEW_MS) return false;
  return elapsed <= MASQUERADE_MAX_DURATION_MS;
}

/** True when this start is past the one-hour TTL. A future start is not expired. */
export function masqueradeSessionPastTtl(startedAt: string, nowMs: number): boolean {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return false;
  return nowMs - started > MASQUERADE_MAX_DURATION_MS;
}

/**
 * GoTrue merges `app_metadata`. Keys left out of the update stay stored.
 * Setting these to null is what removes the masquerade claim.
 */
export function clearedMasqueradeAppMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...meta,
    masquerade_target_tenant_id: null,
    current_tenant_id: null,
  };
}

/** Audit a TTL close only when this update actually ended the open row. */
export function shouldAuditMasqueradeTtlClose(
  closedIds: readonly string[] | null | undefined,
): boolean {
  return (closedIds?.length ?? 0) > 0;
}
