import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDefaultTenantSiteTemplates } from '@/lib/marketing/tenantSiteTemplates';
import type { Database } from '@/lib/supabase/database.types';

/** Inserts default site settings and template pages when a tenant first enables the CMS. */
export async function ensureTenantMarketingSiteSeeded(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const { data: existingSettings } = await admin
    .from('tenant_marketing_site_settings')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingSettings) return;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, city, state, business_email, business_phone')
    .eq('id', tenantId)
    .maybeSingle();

  const city = tenant?.city?.trim() || '';
  const state = tenant?.state?.trim() || '';
  const area = [city, state].filter(Boolean).join(', ');
  const templates = buildDefaultTenantSiteTemplates({
    businessName: tenant?.name,
    city,
    state,
  });

  const { error: settingsError } = await admin.from('tenant_marketing_site_settings').insert({
    tenant_id: tenantId,
    is_published: false,
    homepage_slug: 'home',
    default_cta_label: 'Request a quote',
    default_cta_href: '/contact',
    contact_email: tenant?.business_email?.trim() || null,
    contact_phone: tenant?.business_phone?.trim() || null,
    service_area_summary: area ? `${area} and nearby communities` : null,
    site_template: 'classic',
    color_scheme: 'brand',
  });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const pageRows = templates.map((template) => ({
    tenant_id: tenantId,
    slug: template.slug,
    page_type: template.pageType,
    status: 'draft' as const,
    sort_order: template.sortOrder,
    meta_title: template.metaTitle,
    meta_description: template.metaDescription,
    eyebrow: template.eyebrow,
    headline: template.headline,
    lead: template.lead,
    sections: template.sections,
    faq: template.faq,
    related_links: template.relatedLinks,
    cta_title: template.ctaTitle ?? null,
    cta_lead: template.ctaLead ?? null,
  }));

  const { error: pagesError } = await admin.from('tenant_marketing_pages').insert(pageRows);

  if (pagesError) {
    throw new Error(pagesError.message);
  }
}
