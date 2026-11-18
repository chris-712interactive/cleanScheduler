import type { User } from '@supabase/supabase-js';

export type AppRole = 'super_admin' | 'admin' | 'sales' | 'employee' | 'customer';
export type TenantRole = 'owner' | 'admin' | 'employee' | 'viewer';

export interface AppClaims {
  appRole: AppRole | null;
  currentTenantId: string | null;
  tenantRole: TenantRole | null;
  masqueradeTargetTenantId: string | null;
}

export interface AuthContext {
  user: User;
  claims: AppClaims;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAppRole(value: unknown): AppRole | null {
  const role = asString(value);
  if (!role) return null;
  if (
    role === 'super_admin' ||
    role === 'admin' ||
    role === 'sales' ||
    role === 'employee' ||
    role === 'customer'
  ) {
    return role;
  }
  return null;
}

function parseTenantRole(value: unknown): TenantRole | null {
  const role = asString(value);
  if (!role) return null;
  if (role === 'owner' || role === 'admin' || role === 'employee' || role === 'viewer') {
    return role;
  }
  return null;
}

/**
 * Extract normalized app claims from the Supabase user.
 *
 * `app_role`, `masquerade_target_tenant_id`, `current_tenant_id`, and
 * `tenant_role` are read only from server-written `app_metadata`.
 * `user_metadata` is editable by the signed-in user (`auth.updateUser`) and
 * is not a source for any of these claims. Workspace authority is the
 * `tenant_memberships` row for the current host, not `tenant_role` on the JWT.
 */
export function extractClaims(user: User): AppClaims {
  const appMeta = user.app_metadata ?? {};

  return {
    appRole: parseAppRole(appMeta.app_role),
    currentTenantId: asString(appMeta.current_tenant_id),
    tenantRole: parseTenantRole(appMeta.tenant_role),
    masqueradeTargetTenantId: asString(appMeta.masquerade_target_tenant_id),
  };
}
