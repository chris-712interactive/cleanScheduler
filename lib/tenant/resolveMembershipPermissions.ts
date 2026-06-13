import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantMembership } from '@/lib/auth/tenantAccess';
import {
  defaultPermissionsForSystemRole,
  isPermissionKey,
  type PermissionKey,
} from '@/lib/tenant/permissionCatalog';
import type { Database } from '@/lib/supabase/database.types';

export class PermissionDeniedError extends Error {
  readonly permission: PermissionKey;

  constructor(permission: PermissionKey) {
    super(`You do not have permission to perform this action (${permission}).`);
    this.name = 'PermissionDeniedError';
    this.permission = permission;
  }
}

export function hasPermission(
  permissions: ReadonlySet<PermissionKey>,
  key: PermissionKey,
): boolean {
  return permissions.has(key);
}

export function assertPermission(
  permissions: ReadonlySet<PermissionKey>,
  key: PermissionKey,
): void {
  if (!hasPermission(permissions, key)) {
    throw new PermissionDeniedError(key);
  }
}

export function permissionDeniedMessage(error: unknown): string | null {
  if (error instanceof PermissionDeniedError) {
    return error.message;
  }
  return null;
}

export async function resolveMembershipPermissions(
  admin: SupabaseClient<Database>,
  membership: Pick<TenantMembership, 'tenantId' | 'role' | 'roleId'>,
): Promise<Set<PermissionKey>> {
  if (membership.roleId) {
    const { data: permissionRows, error } = await admin
      .from('tenant_role_permissions')
      .select('permission_key')
      .eq('role_id', membership.roleId);

    if (!error && permissionRows && permissionRows.length > 0) {
      const keys = new Set<PermissionKey>();
      for (const row of permissionRows) {
        if (isPermissionKey(row.permission_key)) {
          keys.add(row.permission_key);
        }
      }
      return keys;
    }
  }

  const { data: systemRole, error: roleError } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', membership.tenantId)
    .eq('is_system', true)
    .eq('slug', membership.role)
    .maybeSingle();

  if (!roleError && systemRole?.id) {
    const { data: permissionRows, error } = await admin
      .from('tenant_role_permissions')
      .select('permission_key')
      .eq('role_id', systemRole.id);

    if (!error && permissionRows && permissionRows.length > 0) {
      const keys = new Set<PermissionKey>();
      for (const row of permissionRows) {
        if (isPermissionKey(row.permission_key)) {
          keys.add(row.permission_key);
        }
      }
      return keys;
    }
  }

  return new Set(defaultPermissionsForSystemRole(membership.role));
}
