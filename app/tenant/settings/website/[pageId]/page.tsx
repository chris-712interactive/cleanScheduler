import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { ensureTenantMarketingSiteSeeded } from '@/lib/tenantSite/seedTenantSite';
import { publicPathForSitePage } from '@/lib/tenantSite/loadTenantSiteData';
import { resolveTenantSiteOrigin } from '@/lib/portal/tenantSiteOrigin';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoPageSection } from '@/lib/marketing/seoContent/types';
import { WebsitePageEditor } from '../WebsitePageEditor';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ pageId: string }>;
};

export default async function TenantWebsitePageEditorPage({ params }: PageProps) {
  const { pageId } = await params;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/website');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);

  if (!isFeatureEnabled(plan, 'tenantMarketingSite')) {
    return (
      <>
        <PageHeader title="Edit page" backHref="/settings/website" backLabel="Website" />
        <FeatureUpgradePanel
          title="Upgrade to edit website pages"
          description={`Upgrade to ${minimumTierLabelForFeature('tenantMarketingSite')} to manage marketing pages.`}
        />
      </>
    );
  }

  await ensureTenantMarketingSiteSeeded(admin, membership.tenantId);

  const [{ data: page, error }, { data: settingsRow }] = await Promise.all([
    admin
      .from('tenant_marketing_pages')
      .select('*')
      .eq('id', pageId)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    admin
      .from('tenant_marketing_site_settings')
      .select('is_published')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  if (error || !page) notFound();

  const originInfo = await resolveTenantSiteOrigin(admin, membership.tenantId);
  const previewPath = `${originInfo.origin}${publicPathForSitePage(page.slug, originInfo.unifiedDomain)}`;

  return (
    <>
      <PageHeader
        title={page.headline || page.slug}
        titleHint="Edit page content and SEO metadata."
        backHref="/settings/website"
        backLabel="Website"
      />
      <Stack gap={6}>
        <WebsitePageEditor
          tenantSlug={membership.tenantSlug}
          isSitePublished={settingsRow?.is_published ?? false}
          page={{
            id: page.id,
            slug: page.slug,
            pageType: page.page_type,
            status: page.status,
            metaTitle: page.meta_title,
            metaDescription: page.meta_description,
            eyebrow: page.eyebrow,
            headline: page.headline,
            lead: page.lead,
            sections: Array.isArray(page.sections) ? (page.sections as SeoPageSection[]) : [],
            faq: Array.isArray(page.faq) ? (page.faq as MarketingFaqItem[]) : [],
            ctaTitle: page.cta_title,
            ctaLead: page.cta_lead,
            locationName: page.location_name,
            city: page.city,
            state: page.state,
            postalCode: page.postal_code,
          }}
          previewPath={previewPath}
        />
      </Stack>
    </>
  );
}
