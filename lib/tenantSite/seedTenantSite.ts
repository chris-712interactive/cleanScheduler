import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_SITE_TEMPLATES } from '@/lib/marketing/tenantSiteTemplates';
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

  const { error: settingsError } = await admin.from('tenant_marketing_site_settings').insert({
    tenant_id: tenantId,
    is_published: false,
    homepage_slug: 'home',
    default_cta_label: 'Request a quote',
    default_cta_href: '/contact',
    site_template: 'classic',
    color_scheme: 'brand',
  });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const pageRows = DEFAULT_TENANT_SITE_TEMPLATES.map((template) => ({
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
    related_links: [],
  }));

  const { error: pagesError } = await admin.from('tenant_marketing_pages').insert(pageRows);

  if (pagesError) {
    throw new Error(pagesError.message);
  }
}
