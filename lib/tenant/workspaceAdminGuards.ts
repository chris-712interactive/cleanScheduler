import type { SupabaseClient } from '@supabase/supabase-js';
import { isPermissionKey, type PermissionKey } from '@/lib/tenant/permissionCatalog';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';

/** Minimum permission an active member must retain to recover team/settings access. */
export const WORKSPACE_RECOVERY_PERMISSION: PermissionKey = 'team.manage_members';

const ADMINISTRATOR_ROLES = new Set<TenantRole>(['owner', 'admin']);

export function isAdministratorRole(role: TenantRole): boolean {
  return ADMINISTRATOR_ROLES.has(role);
}

export async function countActiveAdministrators(
  admin: SupabaseClient<Database>,
  tenantId: string,
  excludeUserId?: string,
): Promise<number> {
  let query = admin
    .from('tenant_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin']);

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function lastAdministratorErrorMessage(): string {
  return 'At least one active owner or admin must remain in this workspace.';
}

export function teamRecoveryAccessErrorMessage(): string {
  return 'At least one active member must keep team management access so the workspace can be administered.';
}

/** Block demoting or deactivating the last active owner/admin. */
export async function assertActiveAdministratorRemains(
  admin: SupabaseClient<Database>,
  tenantId: string,
  targetUserId: string,
  targetRole: TenantRole,
): Promise<string | null> {
  if (!isAdministratorRole(targetRole)) {
    return null;
  }

  const remaining = await countActiveAdministrators(admin, tenantId, targetUserId);
  if (remaining < 1) {
    return lastAdministratorErrorMessage();
  }

  return null;
}

async function loadRolePermissionsById(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<Map<string, Set<PermissionKey>>> {
  const { data: roles, error: rolesError } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', tenantId);

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const roleIds = (roles ?? []).map((role) => role.id);
  if (roleIds.length === 0) {
    return new Map();
  }

  const { data: permissionRows, error } = await admin
    .from('tenant_role_permissions')
    .select('role_id, permission_key')
    .in('role_id', roleIds);

  if (error) {
    throw new Error(error.message);
  }

  const permissionsByRole = new Map<string, Set<PermissionKey>>();
  for (const row of permissionRows ?? []) {
    if (!isPermissionKey(row.permission_key)) continue;
    const keys = permissionsByRole.get(row.role_id) ?? new Set<PermissionKey>();
    keys.add(row.permission_key);
    permissionsByRole.set(row.role_id, keys);
  }

  return permissionsByRole;
}

function memberHasPermission(
  roleId: string | null,
  permissionsByRole: Map<string, Set<PermissionKey>>,
  permission: PermissionKey,
): boolean {
  if (!roleId) return false;
  return permissionsByRole.get(roleId)?.has(permission) ?? false;
}

/** Block role permission edits that remove all team recovery access from active members. */
export async function assertTeamRecoveryAccessRemains(
  admin: SupabaseClient<Database>,
  tenantId: string,
  roleId: string,
  nextPermissionKeys: readonly PermissionKey[],
): Promise<string | null> {
  const permissionsByRole = await loadRolePermissionsById(admin, tenantId);
  permissionsByRole.set(roleId, new Set(nextPermissionKeys));

  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('role_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  const hasRecoveryAccess = (memberships ?? []).some((membership) =>
    memberHasPermission(membership.role_id, permissionsByRole, WORKSPACE_RECOVERY_PERMISSION),
  );

  if (!hasRecoveryAccess) {
    return teamRecoveryAccessErrorMessage();
  }

  return null;
}
