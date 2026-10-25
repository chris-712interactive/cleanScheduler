import { NextResponse } from 'next/server';
import { buildTenantSiteRobots, formatRobotsTxt } from '@/lib/tenantSite/robotsPolicy';
import { loadRequestTenantSiteSeo } from '@/lib/tenantSite/hostSeo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const seo = await loadRequestTenantSiteSeo();
  if (seo.kind !== 'tenant') {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = formatRobotsTxt(
    buildTenantSiteRobots({
      indexable: seo.indexable,
      unifiedDomain: seo.unifiedDomain,
      sitemapUrl: seo.indexable && seo.canonicalHost ? seo.sitemapUrl : null,
    }),
  );

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
