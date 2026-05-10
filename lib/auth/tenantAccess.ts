import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from './portalAccess';
import type { TenantRole } from './types';

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
}

interface MembershipRow {
  tenant_id: string;
  role: TenantRole;
  tenants: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

async function lookupMembership(
  userId: string,
  tenantSlug: string,
): Promise<TenantMembership | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_memberships')
    .select(
      `
      tenant_id,
      role,
      tenants:tenants!inner (
        id,
        slug,
        name
      )
    `,
    )
    .eq('user_id', userId)
    .eq('tenants.slug', tenantSlug)
    .maybeSingle<MembershipRow>();

  if (error || !data || !data.tenants) {
    return null;
  }

  return {
    tenantId: data.tenant_id,
    tenantSlug: data.tenants.slug,
    tenantName: data.tenants.name,
    role: data.role,
  };
}

async function lookupTenantBySlug(
  tenantSlug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Enforces tenant-portal membership by slug and returns normalized membership
 * context for layout/page rendering.
 */
export async function requireTenantPortalAccess(
  tenantSlug: string | null,
  nextPath: string,
): Promise<TenantMembership> {
  const auth = await requirePortalAccess('tenant', nextPath);
  const slug = tenantSlug?.trim().toLowerCase() ?? '';

  if (!slug) {
    redirect('/access-denied?reason=tenant_config');
  }

  const membership = await lookupMembership(auth.user.id, slug);
  if (membership) {
    return membership;
  }

  // Founder / platform ops: no tenant_memberships row required if the tenant
  // exists (support, demos, pre-invite debugging).
  const appRole = auth.claims.appRole;
  if (appRole === 'super_admin' || appRole === 'admin') {
    const tenant = await lookupTenantBySlug(slug);
    if (tenant) {
      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        role: 'admin',
      };
    }
    redirect('/access-denied?reason=unknown_tenant');
  }

  redirect('/access-denied?reason=membership');
}
