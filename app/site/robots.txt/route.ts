import { NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { loadTenantSiteContext } from '@/lib/tenantSite/loadTenantSiteData';
import { isUnifiedSiteRequest } from '@/app/site/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { kind, tenantSlug } = await getPortalContext();
  if (kind !== 'site' || !tenantSlug) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const unifiedDomain = await isUnifiedSiteRequest();
  const site = await loadTenantSiteContext(admin, tenantSlug, { unifiedDomain });
  if (!site) {
    return new NextResponse('Not found', { status: 404 });
  }

  const disallowPortal = site.unifiedDomain ? '\nDisallow: /portal/' : '';
  const indexable = site.indexable && site.settings.isPublished;

  const body = indexable
    ? `User-agent: *
Allow: /
${disallowPortal}
Sitemap: ${site.origin}/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
