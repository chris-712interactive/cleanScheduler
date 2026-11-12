import { createAdminClient } from '@/lib/supabase/server';
import {
  handoffFromRow,
  redeemMasqueradeHandoff,
  supportSessionFromRow,
  type RedeemMasqueradeHandoffResult,
} from '@/lib/auth/masqueradeHandoff';

/**
 * Loads the handoff and support session with the service role, then runs the
 * pure redeem checks. Session cookies are established by `establishSession`
 * on the tenant host that received the request.
 */
export async function redeemStoredMasqueradeHandoff(input: {
  token: string;
  hostTenantId: string;
  establishSession: (email: string) => Promise<boolean>;
  nowMs?: number;
}): Promise<RedeemMasqueradeHandoffResult> {
  const admin = createAdminClient();
  return redeemMasqueradeHandoff(
    {
      token: input.token,
      hostTenantId: input.hostTenantId,
      nowMs: input.nowMs ?? Date.now(),
    },
    {
      findHandoffByHash: async (hash) => {
        const { data, error } = await admin
          .from('masquerade_handoff_tokens')
          .select(
            'id, token_hash, admin_user_id, target_tenant_id, masquerade_session_id, expires_at, used_at',
          )
          .eq('token_hash', hash)
          .maybeSingle();
        if (error || !data) return null;
        return handoffFromRow(data);
      },
      findSession: async (sessionId) => {
        const { data, error } = await admin
          .from('masquerade_sessions')
          .select('id, admin_user_id, target_tenant_id, started_at, ended_at')
          .eq('id', sessionId)
          .maybeSingle();
        if (error || !data) return null;
        return supportSessionFromRow(data);
      },
      loadUser: async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        const user = data?.user;
        if (error || !user) return null;
        return {
          appMetadata: user.app_metadata ?? null,
          userMetadata: user.user_metadata ?? null,
          email: user.email ?? null,
        };
      },
      markUsed: async (id, usedAtIso) => {
        const { data, error } = await admin
          .from('masquerade_handoff_tokens')
          .update({ used_at: usedAtIso })
          .eq('id', id)
          .is('used_at', null)
          .select('id')
          .maybeSingle();
        return !error && Boolean(data?.id);
      },
      releaseUsed: async (id) => {
        const { error } = await admin
          .from('masquerade_handoff_tokens')
          .update({ used_at: null })
          .eq('id', id);
        if (error) throw new Error('masquerade handoff release failed');
      },
      establishSession: input.establishSession,
      audit: async (event) => {
        const { error } = await admin.from('audit_log_entries').insert({
          actor_user_id: event.actorUserId,
          action: 'masquerade.handoff',
          target_tenant_id: event.targetTenantId,
          payload: { masquerade_session_id: event.masqueradeSessionId },
        });
        if (error) throw new Error('masquerade handoff audit failed');
      },
    },
  );
}
