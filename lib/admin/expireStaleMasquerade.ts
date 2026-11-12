import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  clearedMasqueradeAppMetadata,
  liveMasqueradeSessionMatches,
  openMasqueradeSessionsPastTtl,
  shouldAuditMasqueradeTtlClose,
} from '@/lib/auth/masqueradeSession';
import type { AuthContext } from '@/lib/auth/types';

export { MASQUERADE_MAX_DURATION_MS } from '@/lib/auth/masqueradeSession';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Drops a leftover masquerade claim from server-written app metadata.
 * Safe to call when admission already failed closed. Does not redirect.
 */
export async function clearMasqueradeAppMetadata(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { data: userRes, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userRes.user) return;
  const meta = clearedMasqueradeAppMetadata({ ...(userRes.user.app_metadata ?? {}) });
  await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
}

/** Ends masquerade when the open session exceeds the TTL; redirects to admin tenants. */
export async function expireStaleMasqueradeIfNeeded(auth: AuthContext): Promise<void> {
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') return;
  if (!auth.claims.masqueradeTargetTenantId) return;

  const admin = createAdminClient();
  const { data: openSessions } = await admin
    .from('masquerade_sessions')
    .select('id, started_at, target_tenant_id, admin_user_id, ended_at')
    .eq('admin_user_id', auth.user.id)
    .is('ended_at', null);

  const nowMs = Date.now();
  const expired = openMasqueradeSessionsPastTtl(openSessions ?? [], nowMs);
  if (expired.length === 0) return;

  const expiredIds = expired.map((row) => row.id);
  const { data: closed } = await admin
    .from('masquerade_sessions')
    .update({ ended_at: new Date(nowMs).toISOString() })
    .in('id', expiredIds)
    .is('ended_at', null)
    .select('id');

  const closedIds = new Set(closed?.map((row) => row.id) ?? []);
  if (shouldAuditMasqueradeTtlClose([...closedIds])) {
    const audits = expired
      .filter((row) => closedIds.has(row.id))
      .map((row) => ({
        actor_user_id: auth.user.id,
        action: 'masquerade.end',
        target_tenant_id: row.target_tenant_id,
        payload: { reason: 'session_ttl_expired' },
      }));
    if (audits.length > 0) {
      await admin.from('audit_log_entries').insert(audits);
    }
  }

  const claimTenantId = auth.claims.masqueradeTargetTenantId;
  const claimStillLive = (openSessions ?? []).some(
    (row) =>
      !closedIds.has(row.id) &&
      liveMasqueradeSessionMatches(row, {
        userId: auth.user.id,
        tenantId: claimTenantId ?? '',
        nowMs,
      }),
  );
  if (claimStillLive) return;

  await clearMasqueradeAppMetadata(admin, auth.user.id);

  redirect(`${getPublicOrigin('admin')}/tenants?masquerade=expired`);
}
