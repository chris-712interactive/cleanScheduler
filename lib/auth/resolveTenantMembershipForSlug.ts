import { createAdminClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/auth/types';

export interface TenantMembershipSnapshot {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
  roleId: string | null;
}

/** Service-role lookup for middleware and early request routing. */
export async function resolveTenantMembershipForSlug(
  userId: string,
  tenantSlug: string,
): Promise<TenantMembershipSnapshot | null> {
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug || !userId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_memberships')
    .select(
      `
      tenant_id,
      role,
      role_id,
      tenants:tenants!inner ( slug, name )
    `,
    )
    .eq('user_id', userId)
    .eq('tenants.slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data || !data.tenants) return null;

  return {
    tenantId: data.tenant_id,
    tenantSlug: data.tenants.slug,
    tenantName: data.tenants.name,
    role: data.role as TenantRole,
    roleId: data.role_id ?? null,
  };
}
