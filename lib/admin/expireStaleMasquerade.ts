import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  clearedMasqueradeAppMetadata,
  liveMasqueradeSessionMatches,
  masqueradeSessionPastTtl,
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
  const { data: openSession } = await admin
    .from('masquerade_sessions')
    .select('id, started_at, target_tenant_id, admin_user_id, ended_at')
    .eq('admin_user_id', auth.user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openSession?.started_at) return;
  const nowMs = Date.now();
  if (
    liveMasqueradeSessionMatches(openSession, {
      userId: auth.user.id,
      tenantId: openSession.target_tenant_id,
      nowMs,
    })
  ) {
    return;
  }
  if (!masqueradeSessionPastTtl(openSession.started_at, nowMs)) return;

  const { data: closed } = await admin
    .from('masquerade_sessions')
    .update({ ended_at: new Date(nowMs).toISOString() })
    .eq('id', openSession.id)
    .is('ended_at', null)
    .select('id');

  if (shouldAuditMasqueradeTtlClose(closed?.map((row) => row.id))) {
    await admin.from('audit_log_entries').insert({
      actor_user_id: auth.user.id,
      action: 'masquerade.end',
      target_tenant_id: openSession.target_tenant_id,
      payload: { reason: 'session_ttl_expired' },
    });
  }

  await clearMasqueradeAppMetadata(admin, auth.user.id);

  redirect(`${getPublicOrigin('admin')}/tenants?masquerade=expired`);
}
