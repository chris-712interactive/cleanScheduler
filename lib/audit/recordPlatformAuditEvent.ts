import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export async function recordPlatformAuditEvent(
  admin: AdminClient,
  params: {
    actorUserId: string;
    action: string;
    targetTenantId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from('audit_log_entries').insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    target_tenant_id: params.targetTenantId ?? null,
    payload: (params.payload ?? {}) as Json,
  });
}
