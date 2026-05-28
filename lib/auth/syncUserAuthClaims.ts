import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { AppRole, TenantRole } from '@/lib/auth/types';

type AdminClient = SupabaseClient<Database>;

export async function syncUserAuthClaims(
  admin: AdminClient,
  userId: string,
  claims: {
    appRole?: AppRole;
    tenantRole?: TenantRole | null;
    currentTenantId?: string | null;
  },
): Promise<void> {
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userRes.user) {
    throw new Error(userErr?.message ?? 'User not found for claim sync.');
  }

  const meta = { ...(userRes.user.app_metadata ?? {}) };
  if (claims.appRole !== undefined) meta.app_role = claims.appRole;
  if (claims.tenantRole !== undefined) {
    if (claims.tenantRole) meta.tenant_role = claims.tenantRole;
    else delete meta.tenant_role;
  }
  if (claims.currentTenantId !== undefined) {
    if (claims.currentTenantId) meta.current_tenant_id = claims.currentTenantId;
    else delete meta.current_tenant_id;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
  if (error) throw new Error(error.message);
}
