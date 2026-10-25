import { buildTenantSitePageJsonLd } from '@/lib/marketing/tenantSiteJsonLd';
import { tenantSiteContactEmail, tenantSiteContactPhone } from '@/lib/tenantSite/businessProfile';
import type { TenantSiteContext, TenantSitePageContent } from '@/lib/tenantSite/types';

export function TenantSiteJsonLd({
  site,
  page,
}: {
  site: TenantSiteContext;
  page: TenantSitePageContent;
}) {
  const json = buildTenantSitePageJsonLd(page, site.origin, site.branding, {
    homepageSlug: site.settings.homepageSlug,
    contactEmail: tenantSiteContactEmail(site),
    contactPhone: tenantSiteContactPhone(site),
    serviceAreaSummary: site.settings.serviceAreaSummary,
    profile: site.profile,
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}
