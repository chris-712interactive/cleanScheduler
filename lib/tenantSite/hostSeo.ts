import { headers } from 'next/headers';
import {
  buildTenantSiteSitemapEntries,
  type TenantSiteSitemapEntry,
} from '@/lib/marketing/tenantSiteJsonLd';
import { publicEnv } from '@/lib/env';
import { resolveActiveTenantPublicDomain } from '@/lib/portal/resolveTenantPublicDomain';
import { createAdminClient } from '@/lib/supabase/server';
import { classifySeoHost } from '@/lib/tenantSite/classifySeoHost';
import { loadTenantSiteContext } from '@/lib/tenantSite/loadTenantSiteData';
import { absoluteSitemapUrl, requestHostMatchesSiteOrigin } from '@/lib/tenantSite/publicPaths';

export type RequestTenantSiteSeo =
  | { kind: 'platform' }
  | { kind: 'suppress' }
  | {
      kind: 'tenant';
      indexable: boolean;
      /** How pages are pathed on the host that served this request. */
      unifiedDomain: boolean;
      /** True when this host is the canonical origin (custom domain, or `/site` on the tenant subdomain). */
      canonicalHost: boolean;
      sitemapUrl: string;
      entries: TenantSiteSitemapEntry[];
    };

/**
 * Resolves `/robots.txt` and `/sitemap.xml` for the current Host header.
 * Those paths skip the portal rewrite, so they cannot rely on `x-portal`.
 */
export async function loadRequestTenantSiteSeo(): Promise<RequestTenantSiteSeo> {
  const requestHost = (await headers()).get('host') ?? '';
  const classification = classifySeoHost(requestHost, publicEnv.NEXT_PUBLIC_APP_DOMAIN);
  if (classification.kind === 'platform') return { kind: 'platform' };

  try {
    const admin = createAdminClient();
    let tenantSlug: string | null = null;
    let unifiedDomain = false;

    if (classification.kind === 'tenant-subdomain') {
      tenantSlug = classification.tenantSlug;
    } else {
      const domain = await resolveActiveTenantPublicDomain(classification.hostname);
      if (!domain || domain.siteMode !== 'unified') return { kind: 'suppress' };
      tenantSlug = domain.tenantSlug;
      unifiedDomain = true;
    }

    if (!tenantSlug) return { kind: 'suppress' };

    const site = await loadTenantSiteContext(admin, tenantSlug, { unifiedDomain });
    if (!site) return { kind: 'suppress' };

    const indexable = site.indexable && site.settings.isPublished;
    const { data: pages } = indexable
      ? await admin
          .from('tenant_marketing_pages')
          .select('slug, updated_at, page_type')
          .eq('tenant_id', site.tenantId)
          .eq('status', 'published')
          .order('sort_order', { ascending: true })
      : { data: [] };

    return {
      kind: 'tenant',
      indexable,
      unifiedDomain,
      canonicalHost: requestHostMatchesSiteOrigin(requestHost, site.origin),
      sitemapUrl: absoluteSitemapUrl(requestHost),
      entries: buildTenantSiteSitemapEntries(
        site.origin,
        (pages ?? []).map((row) => ({
          slug: row.slug,
          updatedAt: row.updated_at,
          pageType: row.page_type,
        })),
        site.settings.homepageSlug,
      ),
    };
  } catch {
    return { kind: 'suppress' };
  }
}
