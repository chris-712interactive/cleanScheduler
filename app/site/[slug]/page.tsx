import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { TenantSitePageView } from '@/components/tenantSite/TenantSitePage';
import { buildTenantSitePageMetadata } from '@/lib/marketing/tenantSiteMetadata';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  loadPublishedTenantSiteNavPages,
  loadPublishedTenantSitePage,
  loadTenantSiteContext,
  publicPathForSitePage,
} from '@/lib/tenantSite/loadTenantSiteData';
import { isUnifiedSiteRequest } from '@/app/site/actions';
import styles from '@/components/tenantSite/TenantSitePage.module.scss';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TenantSiteSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) notFound();

  const admin = createAdminClient();
  const unifiedDomain = await isUnifiedSiteRequest();
  const site = await loadTenantSiteContext(admin, tenantSlug, { unifiedDomain });
  if (!site) notFound();

  const plan = await resolveTenantEntitlementPlan(admin, site.tenantId);
  if (!isFeatureEnabled(plan, 'tenantMarketingSite')) notFound();

  if (!site.settings.isPublished) {
    return (
      <Container size="md">
        <p className={styles.unpublished}>This website is not published yet.</p>
      </Container>
    );
  }

  const normalizedSlug = slug.trim().toLowerCase();
  if (normalizedSlug === site.settings.homepageSlug) {
    notFound();
  }

  const page = await loadPublishedTenantSitePage(admin, site.tenantId, normalizedSlug);
  if (!page) notFound();

  const navRows = await loadPublishedTenantSiteNavPages(admin, site.tenantId);
  const navLinks = navRows.map((row) => ({
    href: publicPathForSitePage(row.slug, site.unifiedDomain),
    label: row.label,
  }));

  const { data: pageRow } = await admin
    .from('tenant_marketing_pages')
    .select('id')
    .eq('tenant_id', site.tenantId)
    .eq('slug', normalizedSlug)
    .maybeSingle();

  return (
    <TenantSitePageView
      site={site}
      page={page}
      navLinks={navLinks}
      pageId={pageRow?.id ?? null}
      showPoweredBy={plan !== 'pro'}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) return {};

  const admin = createAdminClient();
  const unifiedDomain = await isUnifiedSiteRequest();
  const site = await loadTenantSiteContext(admin, tenantSlug, { unifiedDomain });
  if (!site) return {};

  const page = await loadPublishedTenantSitePage(admin, site.tenantId, slug.trim().toLowerCase());
  if (!page) return {};

  return buildTenantSitePageMetadata({
    origin: site.origin,
    path: publicPathForSitePage(page.slug, site.unifiedDomain),
    title: page.metaTitle || page.headline,
    description: page.metaDescription || page.lead,
    tenantName: site.branding.tenantName,
    ogImageUrl: page.ogImageUrl ?? site.branding.logoUrl,
    noIndex: !site.indexable,
  });
}
