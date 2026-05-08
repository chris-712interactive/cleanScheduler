import type { User } from '@supabase/supabase-js';

export type AppRole = 'super_admin' | 'admin' | 'employee' | 'customer';
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
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseAppRole(value: unknown): AppRole | null {
  const role = asString(value);
  if (!role) return null;
  if (role === 'super_admin' || role === 'admin' || role === 'employee' || role === 'customer') {
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
 * Extract normalized app claims from Supabase user metadata.
 *
 * We favor `app_metadata` for role-bearing claims (server-controlled), but
 * fall back to `user_metadata` for local-dev ergonomics while auth wiring is
 * still maturing.
 */
export function extractClaims(user: User): AppClaims {
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};

  return {
    appRole: parseAppRole(appMeta.app_role ?? userMeta.app_role),
    currentTenantId: asString(appMeta.current_tenant_id ?? userMeta.current_tenant_id),
    tenantRole: parseTenantRole(appMeta.tenant_role ?? userMeta.tenant_role),
    masqueradeTargetTenantId: asString(
      appMeta.masquerade_target_tenant_id ?? userMeta.masquerade_target_tenant_id,
    ),
  };
}
