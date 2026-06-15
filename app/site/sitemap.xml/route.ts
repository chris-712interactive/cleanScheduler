import { NextResponse } from 'next/server';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { buildTenantSiteSitemapEntries } from '@/lib/marketing/tenantSiteJsonLd';
import { loadTenantSiteContext } from '@/lib/tenantSite/loadTenantSiteData';
import { isUnifiedSiteRequest } from '@/app/site/actions';

export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET() {
  const { kind, tenantSlug } = await getPortalContext();
  if (kind !== 'site' || !tenantSlug) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const unifiedDomain = await isUnifiedSiteRequest();
  const site = await loadTenantSiteContext(admin, tenantSlug, { unifiedDomain });
  if (!site || !site.indexable || !site.settings.isPublished) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: pages } = await admin
    .from('tenant_marketing_pages')
    .select('slug, updated_at')
    .eq('tenant_id', site.tenantId)
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  const entries = buildTenantSiteSitemapEntries(
    site.origin,
    (pages ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })),
    site.settings.homepageSlug,
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
