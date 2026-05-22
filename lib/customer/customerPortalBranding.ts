import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';

export interface CustomerPortalBranding {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
}

export async function getCustomerPortalBrandingForTenantSlug(
  tenantSlug: string,
): Promise<CustomerPortalBranding | null> {
  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('name, logo_url, brand_color')
    .eq('slug', tenantSlug.trim().toLowerCase())
    .maybeSingle();

  if (error || !tenant) return null;

  return {
    tenantName: String(tenant.name ?? 'Customer portal').trim() || 'Customer portal',
    logoUrl: tenant.logo_url?.trim() || null,
    brandColor: tenant.brand_color?.trim() || DEFAULT_BRAND_COLOR,
  };
}
