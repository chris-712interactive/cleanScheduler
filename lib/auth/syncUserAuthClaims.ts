import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { appRoleCopiedOnTenantRoleEdit } from '@/lib/auth/tenantMemberAppRole';
import { extractClaims, type AppRole, type TenantRole } from '@/lib/auth/types';

type AdminClient = SupabaseClient<Database>;

/**
 * Patch Auth `app_metadata` with the keys this call actually changes.
 *
 * GoTrue merges `app_metadata`: keys left out stay stored, and JSON null
 * removes a key. Copying the whole object from `getUserById` and writing it
 * back drops concurrent updates to any key in that snapshot. This sends only
 * the patch. Tenant membership flows should use `syncTenantClaimsFromMemberships`,
 * which recomputes the patch from `tenant_memberships` and retries.
 */
export async function syncUserAuthClaims(
  admin: AdminClient,
  userId: string,
  claims: {
    appRole?: AppRole;
    /**
     * Recompute platform role from this user's current Auth `app_metadata`.
     * Ignores `appRole` when both are set, so a profile column cannot be copied in.
     * The resolved role is returned and is not written back, so a stale read
     * cannot overwrite a newer platform role.
     */
    preservePlatformRoleFromAuth?: boolean;
    tenantRole?: TenantRole | null;
    currentTenantId?: string | null;
  },
): Promise<AppRole | null> {
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userRes.user) {
    throw new Error(userErr?.message ?? 'User not found for claim sync.');
  }

  const patch: Record<string, unknown> = {};
  let resolvedAppRole = extractClaims(userRes.user).appRole;
  if (claims.preservePlatformRoleFromAuth) {
    resolvedAppRole = appRoleCopiedOnTenantRoleEdit({ authAppRole: resolvedAppRole });
  } else if (claims.appRole !== undefined) {
    patch.app_role = claims.appRole;
    resolvedAppRole = claims.appRole;
  }
  if (claims.tenantRole !== undefined) {
    patch.tenant_role = claims.tenantRole;
  }
  if (claims.currentTenantId !== undefined) {
    patch.current_tenant_id = claims.currentTenantId;
  }

  if (Object.keys(patch).length === 0) return resolvedAppRole;

  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: patch });
  if (error) throw new Error(error.message);
  return resolvedAppRole;
}
