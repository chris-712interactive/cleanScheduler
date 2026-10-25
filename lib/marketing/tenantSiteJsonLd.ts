import { buildTenantSitePublicUrl } from '@/lib/tenantSite/publicPaths';
import type {
  TenantSiteBranding,
  TenantSitePageContent,
  TenantSiteProfile,
} from '@/lib/tenantSite/types';

export type TenantSiteSitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'weekly' | 'monthly';
  priority: number;
};

type JsonLdOptions = {
  homepageSlug: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  serviceAreaSummary?: string | null;
  profile?: TenantSiteProfile | null;
};

function sectionDescription(section: TenantSitePageContent['sections'][number]): string {
  const paragraph = section.paragraphs?.find((value) => value.trim());
  if (paragraph) return paragraph.trim();
  return (section.bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .join('. ');
}

function sitemapWeight(
  pageType: string | undefined,
  isHome: boolean,
): Pick<TenantSiteSitemapEntry, 'changeFrequency' | 'priority'> {
  if (isHome) return { changeFrequency: 'weekly', priority: 1 };
  switch (pageType) {
    case 'services':
      return { changeFrequency: 'monthly', priority: 0.9 };
    case 'service_area':
      return { changeFrequency: 'monthly', priority: 0.8 };
    case 'contact':
      return { changeFrequency: 'monthly', priority: 0.7 };
    case 'faq':
    case 'about':
      return { changeFrequency: 'monthly', priority: 0.6 };
    default:
      return { changeFrequency: 'monthly', priority: 0.5 };
  }
}

export function buildTenantSitePageJsonLd(
  page: TenantSitePageContent,
  origin: string,
  branding: TenantSiteBranding,
  options: JsonLdOptions,
): Record<string, unknown> {
  const homepageSlug = options.homepageSlug || 'home';
  const pageUrl = buildTenantSitePublicUrl(origin, page.slug, homepageSlug);
  const homeUrl = buildTenantSitePublicUrl(origin, homepageSlug, homepageSlug);
  const profile = options.profile;

  const localBusiness: Record<string, unknown> = {
    '@type': 'HouseCleaner',
    '@id': `${homeUrl}/#business`,
    name: branding.tenantName,
    url: homeUrl,
    description: page.metaDescription || page.lead || undefined,
    inLanguage: 'en-US',
  };

  if (branding.logoUrl) {
    localBusiness.image = branding.logoUrl;
    localBusiness.logo = {
      '@type': 'ImageObject',
      url: branding.logoUrl,
    };
  }

  if (options.contactPhone) localBusiness.telephone = options.contactPhone;
  if (options.contactEmail) localBusiness.email = options.contactEmail;

  const addressCity = profile?.city || page.city;
  const addressRegion = profile?.state || page.state;
  if (addressCity && addressRegion) {
    localBusiness.address = {
      '@type': 'PostalAddress',
      streetAddress: profile?.addressLine1 || undefined,
      addressLocality: addressCity,
      addressRegion,
      postalCode: profile?.postalCode || page.postalCode || undefined,
      addressCountry: profile?.country || 'US',
    };
  }

  const areaServed: Array<Record<string, unknown> | string> = [];
  if (options.serviceAreaSummary?.trim()) areaServed.push(options.serviceAreaSummary.trim());
  if (page.pageType === 'service_area' && page.city) {
    areaServed.push({
      '@type': 'City',
      name: page.locationName || page.city,
    });
  } else if (profile?.city) {
    areaServed.push({
      '@type': 'City',
      name: profile.city,
    });
  }
  if (areaServed.length === 1) localBusiness.areaServed = areaServed[0];
  else if (areaServed.length > 1) localBusiness.areaServed = areaServed;

  if (
    profile &&
    profile.latitude != null &&
    profile.longitude != null &&
    Number.isFinite(profile.latitude) &&
    Number.isFinite(profile.longitude)
  ) {
    localBusiness.geo = {
      '@type': 'GeoCoordinates',
      latitude: profile.latitude,
      longitude: profile.longitude,
    };
  }

  if (profile && profile.openingDays.length > 0 && profile.opens && profile.closes) {
    localBusiness.openingHoursSpecification = {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: profile.openingDays,
      opens: profile.opens,
      closes: profile.closes,
    };
  }

  if (options.contactPhone || options.contactEmail) {
    localBusiness.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: options.contactPhone || undefined,
      email: options.contactEmail || undefined,
      availableLanguage: 'English',
    };
  }

  const catalogPages =
    page.pageType === 'home' || page.pageType === 'services' || page.pageType === 'service_area';
  const offers = catalogPages
    ? page.sections
        .map((section) => {
          const description = sectionDescription(section);
          if (!section.title.trim()) return null;
          return {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: section.title,
              description: description || undefined,
              provider: { '@id': `${homeUrl}/#business` },
              areaServed: localBusiness.areaServed,
            },
          };
        })
        .filter((offer): offer is NonNullable<typeof offer> => offer != null)
    : [];

  if (offers.length > 0) {
    localBusiness.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `${branding.tenantName} cleaning services`,
      itemListElement: offers,
    };
  }

  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.metaTitle || page.headline,
    description: page.metaDescription || page.lead,
    isPartOf: { '@id': `${homeUrl}/#website` },
    about: { '@id': `${homeUrl}/#business` },
    inLanguage: 'en-US',
  };

  if (page.ogImageUrl) webPage.primaryImageOfPage = page.ogImageUrl;

  const graph: Record<string, unknown>[] = [
    localBusiness,
    {
      '@type': 'WebSite',
      '@id': `${homeUrl}/#website`,
      url: homeUrl,
      name: branding.tenantName,
      inLanguage: 'en-US',
      publisher: { '@id': `${homeUrl}/#business` },
    },
    webPage,
  ];

  if (page.slug !== homepageSlug) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumbs`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.headline || page.metaTitle || page.slug,
          item: pageUrl,
        },
      ],
    });
  }

  if (page.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      url: pageUrl,
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
  pages: Array<{ slug: string; updatedAt: string; pageType?: string | null }>,
  homepageSlug: string,
): TenantSiteSitemapEntry[] {
  return pages.map((page) => {
    const isHome = page.slug === homepageSlug;
    const weight = sitemapWeight(page.pageType ?? undefined, isHome);
    return {
      url: buildTenantSitePublicUrl(origin, page.slug, homepageSlug),
      lastModified: new Date(page.updatedAt),
      ...weight,
    };
  });
}
