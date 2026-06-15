import type { TenantSiteBranding, TenantSitePageContent } from '@/lib/tenantSite/types';

export function buildTenantSitePageJsonLd(
  page: TenantSitePageContent,
  origin: string,
  branding: TenantSiteBranding,
  options?: {
    contactEmail?: string | null;
    contactPhone?: string | null;
    serviceAreaSummary?: string | null;
  },
): Record<string, unknown> {
  const pagePath = page.slug === 'home' ? '/' : `/${page.slug}`;
  const pageUrl = `${origin}${pagePath}`;

  const localBusiness: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': `${origin}/#business`,
    name: branding.tenantName,
    url: origin,
  };

  if (branding.logoUrl) {
    localBusiness.image = branding.logoUrl;
  }
  if (options?.contactPhone) {
    localBusiness.telephone = options.contactPhone;
  }
  if (options?.contactEmail) {
    localBusiness.email = options.contactEmail;
  }
  if (page.city && page.state) {
    localBusiness.address = {
      '@type': 'PostalAddress',
      addressLocality: page.city,
      addressRegion: page.state,
      postalCode: page.postalCode ?? undefined,
    };
  } else if (options?.serviceAreaSummary) {
    localBusiness.areaServed = options.serviceAreaSummary;
  }

  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.metaTitle || page.headline,
    description: page.metaDescription || page.lead,
    isPartOf: { '@id': `${origin}/#website` },
    about: { '@id': `${origin}/#business` },
  };

  const graph: Record<string, unknown>[] = [
    localBusiness,
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: origin,
      name: branding.tenantName,
      publisher: { '@id': `${origin}/#business` },
    },
    webPage,
  ];

  if (page.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function buildTenantSiteSitemapEntries(
  origin: string,
  pages: Array<{ slug: string; updatedAt: string }>,
  homepageSlug: string,
): Array<{ url: string; lastModified: Date }> {
  return pages.map((page) => {
    const path = page.slug === homepageSlug ? '/' : `/${page.slug}`;
    return {
      url: `${origin}${path}`,
      lastModified: new Date(page.updatedAt),
    };
  });
}
