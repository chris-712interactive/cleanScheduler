import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { isTenantSiteIndexable } from '@/lib/tenantSite/indexingPolicy';
import type {
  TenantSiteBranding,
  TenantSiteContext,
  TenantSiteNavLink,
  TenantSitePageContent,
  TenantSiteSettings,
} from '@/lib/tenantSite/types';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';
import {
  getTenantSiteOriginForRequest,
  resolveTenantSiteOrigin,
} from '@/lib/portal/tenantSiteOrigin';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantBillingStatus } from '@/lib/billing/tenantSubscriptionAccess';
import { buildTenantSiteNavPages } from '@/lib/tenantSite/navLabels';

type PageRow = Database['public']['Tables']['tenant_marketing_pages']['Row'];
type SettingsRow = Database['public']['Tables']['tenant_marketing_site_settings']['Row'];

export function mapTenantSiteSettings(row: SettingsRow): TenantSiteSettings {
  return {
    isPublished: row.is_published,
    homepageSlug: row.homepage_slug,
    defaultCtaLabel: row.default_cta_label,
    defaultCtaHref: row.default_cta_href,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    serviceAreaSummary: row.service_area_summary,
    siteTemplate: row.site_template,
    colorScheme: row.color_scheme,
  };
}

export function mapTenantSitePage(row: PageRow): TenantSitePageContent {
  return {
    slug: row.slug,
    pageType: row.page_type,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    ogImageUrl: row.og_image_url,
    eyebrow: row.eyebrow,
    headline: row.headline,
    lead: row.lead,
    sections: Array.isArray(row.sections)
      ? (row.sections as TenantSitePageContent['sections'])
      : [],
    faq: Array.isArray(row.faq) ? (row.faq as TenantSitePageContent['faq']) : [],
    relatedLinks: Array.isArray(row.related_links)
      ? (row.related_links as TenantSitePageContent['relatedLinks'])
      : [],
    ctaTitle: row.cta_title,
    ctaLead: row.cta_lead,
    locationName: row.location_name,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
  };
}

export async function loadTenantSiteBranding(
  admin: SupabaseClient<Database>,
  tenantSlug: string,
): Promise<TenantSiteBranding | null> {
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, slug, name, logo_url, brand_color')
    .eq('slug', tenantSlug.trim().toLowerCase())
    .maybeSingle();

  if (error || !tenant) return null;

  return {
    tenantName: String(tenant.name ?? 'Cleaning company').trim() || 'Cleaning company',
    logoUrl: tenant.logo_url?.trim() || null,
    brandColor: tenant.brand_color?.trim() || DEFAULT_BRAND_COLOR,
    slug: tenant.slug,
  };
}

export async function loadTenantSiteContext(
  admin: SupabaseClient<Database>,
  tenantSlug: string,
  options?: { unifiedDomain?: boolean },
): Promise<(TenantSiteContext & { tenantId: string }) | null> {
  const branding = await loadTenantSiteBranding(admin, tenantSlug);
  if (!branding) return null;

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug.trim().toLowerCase())
    .maybeSingle();

  if (!tenant) return null;

  const [{ data: settingsRow }, { data: billing }, plan, originInfo] = await Promise.all([
    admin
      .from('tenant_marketing_site_settings')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenant.id).maybeSingle(),
    resolveTenantEntitlementPlan(admin, tenant.id),
    resolveTenantSiteOrigin(admin, tenant.id),
  ]);

  if (!settingsRow) return null;

  const settings = mapTenantSiteSettings(settingsRow);
  const billingStatus = (billing?.status ?? 'trialing') as TenantBillingStatus;
  const unifiedDomain = options?.unifiedDomain ?? originInfo.unifiedDomain;
  const origin = options?.unifiedDomain
    ? originInfo.origin
    : await getTenantSiteOriginForRequest(admin, tenant.id);

  return {
    tenantId: tenant.id,
    branding,
    settings,
    origin,
    unifiedDomain,
    portalLoginHref: unifiedDomain ? '/portal' : originInfo.portalLoginHref,
    indexable: isTenantSiteIndexable({
      plan,
      billingStatus,
      isPublished: settings.isPublished,
    }),
  };
}

export async function loadPublishedTenantSitePage(
  admin: SupabaseClient<Database>,
  tenantId: string,
  slug: string,
  options?: { includeDraftPreview?: boolean },
): Promise<TenantSitePageContent | null> {
  let query = admin
    .from('tenant_marketing_pages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slug', slug.trim().toLowerCase());

  if (!options?.includeDraftPreview) {
    query = query.eq('status', 'published');
  }

  const { data: row, error } = await query.maybeSingle();
  if (error || !row) return null;
  return mapTenantSitePage(row);
}

export async function loadPublishedTenantSiteNavPages(
  admin: SupabaseClient<Database>,
  tenantId: string,
  options?: { primaryOnly?: boolean },
): Promise<Array<{ slug: string; label: string; sortOrder: number }>> {
  const { data: rows, error } = await admin
    .from('tenant_marketing_pages')
    .select('slug, page_type, meta_title, headline, location_name, city, sort_order')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (error || !rows) return [];

  return buildTenantSiteNavPages(rows, options);
}

export async function loadTenantSitePagesForAdmin(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PageRow[]> {
  const { data: rows, error } = await admin
    .from('tenant_marketing_pages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function loadTenantMarketingLeads(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<Database['public']['Tables']['tenant_marketing_leads']['Row'][]> {
  const { data: rows, error } = await admin
    .from('tenant_marketing_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return rows ?? [];
}

export function mapTenantSiteNavLinks(
  rows: Array<{ slug: string; label: string }>,
  unifiedDomain: boolean,
): TenantSiteNavLink[] {
  return rows.map((row) => ({
    href: publicPathForSitePage(row.slug, unifiedDomain),
    label: row.label,
  }));
}

export function publicPathForSitePage(slug: string, unifiedDomain: boolean): string {
  if (slug === 'home') {
    return unifiedDomain ? '/' : '/site';
  }
  return unifiedDomain ? `/${slug}` : `/site/${slug}`;
}
