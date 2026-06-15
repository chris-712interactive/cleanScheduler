import type { SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { originForHostname, customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantPublicDomainSiteMode } from '@/lib/tenantSite/types';

export type TenantSiteOriginInfo = {
  origin: string;
  unifiedDomain: boolean;
  portalLoginHref: string;
  siteMode: TenantPublicDomainSiteMode | null;
};

export async function resolveTenantSiteOrigin(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantSiteOriginInfo> {
  const [{ data: domain }, { data: tenant }] = await Promise.all([
    admin
      .from('tenant_customer_portal_domains')
      .select('hostname, status, site_mode')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle(),
    admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle(),
  ]);

  const slug = tenant?.slug ?? '';
  const siteMode = (domain?.site_mode as TenantPublicDomainSiteMode | null) ?? null;

  if (domain?.hostname && siteMode === 'unified') {
    return {
      origin: originForHostname(domain.hostname),
      unifiedDomain: true,
      portalLoginHref: '/portal',
      siteMode,
    };
  }

  if (!slug) {
    return {
      origin: getPublicOrigin(null),
      unifiedDomain: false,
      portalLoginHref: await customerPortalUrlForTenant(admin, tenantId, '/'),
      siteMode,
    };
  }

  return {
    origin: `${getPublicOrigin(slug)}/site`,
    unifiedDomain: false,
    portalLoginHref: await customerPortalUrlForTenant(admin, tenantId, '/'),
    siteMode,
  };
}

/** Origin for the current site request (respects unified custom domain from headers). */
export async function getTenantSiteOriginForRequest(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<string> {
  const h = await headers();
  const whiteLabelHostname = h.get('x-white-label-hostname');
  const unified = h.get('x-unified-public-domain') === '1';

  if (whiteLabelHostname && unified) {
    return originForHostname(whiteLabelHostname);
  }

  const info = await resolveTenantSiteOrigin(admin, tenantId);
  return info.origin;
}

export async function siteUrlForTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
  path = '/',
): Promise<string> {
  const info = await resolveTenantSiteOrigin(admin, tenantId);
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (info.unifiedDomain) {
    if (normalized === '/' || normalized === '/home') return info.origin;
    return `${info.origin}${normalized}`;
  }

  if (normalized === '/' || normalized === '/home') return info.origin;
  return `${info.origin}${normalized === '/site' ? '' : normalized.replace(/^\/site/, '')}`;
}
