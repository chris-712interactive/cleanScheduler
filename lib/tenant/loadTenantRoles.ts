import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import type { PermissionKey } from '@/lib/tenant/permissionCatalog';
import type { Database } from '@/lib/supabase/database.types';

export interface TenantRoleRow {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  baseRole: TenantRole;
  isSystem: boolean;
  permissions: PermissionKey[];
  memberCount: number;
}

export async function loadTenantRoles(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantRoleRow[]> {
  const { data: roles, error } = await admin
    .from('tenant_roles')
    .select('id, tenant_id, name, slug, description, base_role, is_system')
    .eq('tenant_id', tenantId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error || !roles) {
    return [];
  }

  const roleIds = roles.map((role) => role.id);
  const [{ data: permissionRows }, { data: membershipRows }] = await Promise.all([
    admin.from('tenant_role_permissions').select('role_id, permission_key').in('role_id', roleIds),
    admin
      .from('tenant_memberships')
      .select('role_id')
      .eq('tenant_id', tenantId)
      .in('role_id', roleIds),
  ]);

  const permissionsByRole = new Map<string, PermissionKey[]>();
  for (const row of permissionRows ?? []) {
    const list = permissionsByRole.get(row.role_id) ?? [];
    list.push(row.permission_key as PermissionKey);
    permissionsByRole.set(row.role_id, list);
  }

  const memberCountByRole = new Map<string, number>();
  for (const row of membershipRows ?? []) {
    if (!row.role_id) continue;
    memberCountByRole.set(row.role_id, (memberCountByRole.get(row.role_id) ?? 0) + 1);
  }

  return roles.map((role) => ({
    id: role.id,
    tenantId: role.tenant_id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    baseRole: role.base_role as TenantRole,
    isSystem: role.is_system,
    permissions: permissionsByRole.get(role.id) ?? [],
    memberCount: memberCountByRole.get(role.id) ?? 0,
  }));
}
