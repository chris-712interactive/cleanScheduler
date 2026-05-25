import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { AuthContext } from '@/lib/auth/types';

export const MASQUERADE_MAX_DURATION_MS = 60 * 60 * 1000;

/** Ends masquerade when the open session exceeds the TTL; redirects to admin tenants. */
export async function expireStaleMasqueradeIfNeeded(auth: AuthContext): Promise<void> {
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') return;
  if (!auth.claims.masqueradeTargetTenantId) return;

  const admin = createAdminClient();
  const { data: openSession } = await admin
    .from('masquerade_sessions')
    .select('id, started_at, target_tenant_id')
    .eq('admin_user_id', auth.user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openSession?.started_at) return;

  const elapsed = Date.now() - new Date(openSession.started_at).getTime();
  if (elapsed <= MASQUERADE_MAX_DURATION_MS) return;

  await admin
    .from('masquerade_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', openSession.id);

  await admin.from('audit_log_entries').insert({
    actor_user_id: auth.user.id,
    action: 'masquerade.end',
    target_tenant_id: openSession.target_tenant_id,
    payload: { reason: 'session_ttl_expired' },
  });

  const { data: userRes } = await admin.auth.admin.getUserById(auth.user.id);
  if (userRes.user) {
    const meta = { ...(userRes.user.app_metadata ?? {}) };
    delete meta.masquerade_target_tenant_id;
    delete meta.current_tenant_id;
    await admin.auth.admin.updateUserById(auth.user.id, { app_metadata: meta });
  }

  redirect(`${getPublicOrigin('admin')}/tenants?masquerade=expired`);
}
