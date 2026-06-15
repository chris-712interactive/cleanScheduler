'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertLimitNotExceeded,
  assertFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
  minimumTierLabelForFeature,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { ensureTenantMarketingSiteSeeded } from '@/lib/tenantSite/seedTenantSite';
import { isTenantSiteColorScheme, isTenantSiteTemplate } from '@/lib/tenantSite/siteTheme';
import { syncSupabaseAuthRedirectForHostname } from '@/lib/portal/customerPortalDomainActivation';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoPageSection } from '@/lib/marketing/seoContent/types';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantMarketingPageType } from '@/lib/tenantSite/types';

export type WebsiteActionState = {
  error?: string;
  success?: string;
};

type PageRow = Database['public']['Tables']['tenant_marketing_pages']['Row'];

function sanitizeSections(raw: unknown): PageRow['sections'] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const section = entry as SeoPageSection;
      const title = String(section.title ?? '').trim();
      const paragraphs = Array.isArray(section.paragraphs)
        ? section.paragraphs.map((value) => String(value).trim()).filter(Boolean)
        : [];
      const bullets = Array.isArray(section.bullets)
        ? section.bullets.map((value) => String(value).trim()).filter(Boolean)
        : [];

      return { title, paragraphs, bullets };
    })
    .filter(
      (section) => section.title || section.paragraphs.length > 0 || section.bullets.length > 0,
    );
}

function sanitizeFaq(raw: unknown): PageRow['faq'] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const item = entry as MarketingFaqItem;
      return {
        question: String(item.question ?? '').trim(),
        answer: String(item.answer ?? '').trim(),
      };
    })
    .filter((item) => item.question && item.answer);
}

function parseSections(raw: FormData): PageRow['sections'] {
  const json = String(raw.get('sections_json') ?? '').trim();
  if (!json) return [];
  try {
    return sanitizeSections(JSON.parse(json));
  } catch {
    return [];
  }
}

function parseFaq(raw: FormData): PageRow['faq'] {
  const json = String(raw.get('faq_json') ?? '').trim();
  if (!json) return [];
  try {
    return sanitizeFaq(JSON.parse(json));
  } catch {
    return [];
  }
}

async function membershipForAction(formData: FormData) {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/website');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    throw new Error('Only owners and admins can manage website settings.');
  }
  const admin = createAdminClient();
  await assertTenantFeatureEnabled(admin, membership.tenantId, 'tenantMarketingSite');
  await ensureTenantMarketingSiteSeeded(admin, membership.tenantId);
  return { membership, admin };
}

export async function toggleWebsitePublishAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const publish = formData.get('publish') === 'true';

    const { error } = await admin
      .from('tenant_marketing_site_settings')
      .update({ is_published: publish })
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    if (publish) {
      const publishedAt = new Date().toISOString();
      const { error: pagesError } = await admin
        .from('tenant_marketing_pages')
        .update({ status: 'published', published_at: publishedAt })
        .eq('tenant_id', membership.tenantId)
        .eq('status', 'draft');

      if (pagesError) return { error: pagesError.message };
    }

    revalidatePath('/tenant/settings/website', 'page');
    return { success: publish ? 'Website published.' : 'Website unpublished.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not update publish state.' };
  }
}

export async function toggleWebsitePagePublishAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const pageId = String(formData.get('page_id') ?? '').trim();
    if (!pageId) return { error: 'Page not found.' };

    const publish = formData.get('publish') === 'true';

    const { data: existing } = await admin
      .from('tenant_marketing_pages')
      .select('id')
      .eq('id', pageId)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();

    if (!existing) return { error: 'Page not found.' };

    const { error } = await admin
      .from('tenant_marketing_pages')
      .update({
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      })
      .eq('id', pageId)
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    revalidatePath(`/tenant/settings/website/${pageId}`, 'page');
    return { success: publish ? 'Page published.' : 'Page unpublished.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not update page publish state.' };
  }
}

export async function updateWebsiteSettingsAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);

    const { error } = await admin
      .from('tenant_marketing_site_settings')
      .update({
        default_cta_label:
          String(formData.get('default_cta_label') ?? '').trim() || 'Request a quote',
        default_cta_href: String(formData.get('default_cta_href') ?? '').trim() || '/contact',
        contact_email: String(formData.get('contact_email') ?? '').trim() || null,
        contact_phone: String(formData.get('contact_phone') ?? '').trim() || null,
        service_area_summary: String(formData.get('service_area_summary') ?? '').trim() || null,
      })
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    return { success: 'Website settings saved.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not save settings.' };
  }
}

export async function updateWebsiteAppearanceAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const siteTemplateRaw = String(formData.get('site_template') ?? 'classic');
    const colorSchemeRaw = String(formData.get('color_scheme') ?? 'brand');

    if (!isTenantSiteTemplate(siteTemplateRaw)) {
      return { error: 'Choose a valid site template.' };
    }
    if (!isTenantSiteColorScheme(colorSchemeRaw)) {
      return { error: 'Choose a valid color scheme.' };
    }

    const { error } = await admin
      .from('tenant_marketing_site_settings')
      .update({
        site_template: siteTemplateRaw,
        color_scheme: colorSchemeRaw,
      })
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    return { success: 'Website appearance updated.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not update appearance.' };
  }
}

export async function updateWebsitePageAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const pageId = String(formData.get('page_id') ?? '').trim();
    if (!pageId) return { error: 'Page not found.' };

    const slug = String(formData.get('slug') ?? '')
      .trim()
      .toLowerCase();

    const { data: existing } = await admin
      .from('tenant_marketing_pages')
      .select('page_type, slug')
      .eq('id', pageId)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();

    if (!existing) return { error: 'Page not found.' };

    const { error } = await admin
      .from('tenant_marketing_pages')
      .update({
        slug: existing.page_type === 'home' ? existing.slug : slug,
        meta_title: String(formData.get('meta_title') ?? '').trim(),
        meta_description: String(formData.get('meta_description') ?? '').trim(),
        eyebrow: String(formData.get('eyebrow') ?? '').trim(),
        headline: String(formData.get('headline') ?? '').trim(),
        lead: String(formData.get('lead') ?? '').trim(),
        sections: parseSections(formData),
        faq: parseFaq(formData),
        cta_title: String(formData.get('cta_title') ?? '').trim() || null,
        cta_lead: String(formData.get('cta_lead') ?? '').trim() || null,
        location_name: String(formData.get('location_name') ?? '').trim() || null,
        city: String(formData.get('city') ?? '').trim() || null,
        state: String(formData.get('state') ?? '').trim() || null,
        postal_code: String(formData.get('postal_code') ?? '').trim() || null,
      })
      .eq('id', pageId)
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    revalidatePath(`/tenant/settings/website/${pageId}`, 'page');
    return { success: 'Page saved.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not save page.' };
  }
}

export async function createWebsitePageAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);

    const { count } = await admin
      .from('tenant_marketing_pages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId);

    assertLimitNotExceeded(plan, 'maxMarketingSitePages', count ?? 0);

    const pageType = String(formData.get('page_type') ?? 'custom') as TenantMarketingPageType;
    if (pageType === 'service_area') {
      const serviceAreaCount = await admin
        .from('tenant_marketing_pages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', membership.tenantId)
        .eq('page_type', 'service_area');
      assertLimitNotExceeded(plan, 'maxMarketingSiteServiceAreaPages', serviceAreaCount.count ?? 0);
    }

    const slug = String(formData.get('slug') ?? '')
      .trim()
      .toLowerCase();
    if (!slug) return { error: 'Slug is required.' };

    const { data: maxSort } = await admin
      .from('tenant_marketing_pages')
      .select('sort_order')
      .eq('tenant_id', membership.tenantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await admin
      .from('tenant_marketing_pages')
      .insert({
        tenant_id: membership.tenantId,
        slug,
        page_type: pageType,
        status: 'draft',
        sort_order: (maxSort?.sort_order ?? 0) + 1,
        meta_title: String(formData.get('meta_title') ?? '').trim() || slug,
        headline: String(formData.get('headline') ?? '').trim() || slug,
      })
      .select('id')
      .single();

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    return { success: 'Page created.' };
  } catch (error) {
    return {
      error: featureGateErrorMessage(error) ?? 'Could not create page.',
    };
  }
}

export async function updateWebsiteLeadStatusAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const leadId = String(formData.get('lead_id') ?? '').trim();
    const status = String(formData.get('status') ?? '').trim();

    if (!leadId || !['new', 'contacted', 'converted', 'closed'].includes(status)) {
      return { error: 'Invalid lead update.' };
    }

    const { error } = await admin
      .from('tenant_marketing_leads')
      .update({ status: status as Database['public']['Enums']['tenant_marketing_lead_status'] })
      .eq('id', leadId)
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    revalidatePath('/tenant/settings/website', 'page');
    revalidatePath('/tenant/settings/website/leads', 'page');
    return { success: 'Lead updated.' };
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Could not update lead.' };
  }
}

export async function updateWebsiteDomainModeAction(
  _prev: WebsiteActionState,
  formData: FormData,
): Promise<WebsiteActionState> {
  try {
    const { membership, admin } = await membershipForAction(formData);
    const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
    assertFeatureEnabled(plan, 'tenantMarketingSiteCustomDomain');

    const siteMode = String(formData.get('site_mode') ?? 'portal_only');
    if (siteMode !== 'portal_only' && siteMode !== 'unified') {
      return { error: 'Invalid domain mode.' };
    }

    const { data: domain } = await admin
      .from('tenant_customer_portal_domains')
      .select('hostname, status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();

    if (!domain || domain.status !== 'active') {
      return {
        error: `Activate a custom domain in Customer portal settings before enabling unified mode.`,
      };
    }

    const { error } = await admin
      .from('tenant_customer_portal_domains')
      .update({
        site_mode: siteMode as Database['public']['Enums']['tenant_public_domain_site_mode'],
      })
      .eq('tenant_id', membership.tenantId);

    if (error) return { error: error.message };

    if (domain.hostname) {
      await syncSupabaseAuthRedirectForHostname(admin, membership.tenantId, domain.hostname);
    }

    revalidatePath('/tenant/settings/website/domain', 'page');
    revalidatePath('/tenant/settings/customer-portal', 'page');
    return {
      success:
        siteMode === 'unified'
          ? 'Unified domain enabled — marketing at /, customer portal at /portal.'
          : 'Domain set to portal-only mode.',
    };
  } catch (error) {
    const msg = featureGateErrorMessage(error);
    return {
      error:
        msg ??
        `Upgrade to ${minimumTierLabelForFeature('tenantMarketingSiteCustomDomain')} for unified domains.`,
    };
  }
}
