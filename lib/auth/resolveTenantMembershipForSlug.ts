import { createAdminClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/auth/types';

export interface TenantMembershipSnapshot {
  tenantId: string;
  role: TenantRole;
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
      tenants:tenants!inner ( slug )
    `,
    )
    .eq('user_id', userId)
    .eq('tenants.slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    tenantId: data.tenant_id,
    role: data.role as TenantRole,
  };
}
