import type { MetadataRoute } from 'next';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { loadRequestTenantSiteSeo } from '@/lib/tenantSite/hostSeo';
import { buildTenantSiteRobots } from '@/lib/tenantSite/robotsPolicy';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await loadRequestTenantSiteSeo();

  if (seo.kind === 'suppress') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  if (seo.kind === 'tenant') {
    return buildTenantSiteRobots({
      indexable: seo.indexable,
      unifiedDomain: seo.unifiedDomain,
      sitemapUrl: seo.indexable && seo.canonicalHost ? seo.sitemapUrl : null,
    });
  }

  const origin = getPublicOrigin(null);
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/tenant/', '/customer/'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
