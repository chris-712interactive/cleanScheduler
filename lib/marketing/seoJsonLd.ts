import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { LEGAL_BUSINESS_ADDRESS, LEGAL_CONTACT_EMAIL, PRODUCT_NAME } from '@/lib/legal/site';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { HelpGuideArticle, SeoMarketingPage } from '@/lib/marketing/seoContent/types';

const SCHEMA_CONTEXT = 'https://schema.org';

/** Customer-facing support inbox (also published on /help/contact). */
const SUPPORT_EMAIL = 'support@cleanscheduler.com';

/** Square brand mark for Organization logo (Google Images–crawlable PNG, ≥112px). */
const ORGANIZATION_LOGO_PATH = '/favicon/web-app-manifest-512x512.png';

const ORGANIZATION_DESCRIPTION =
  'Clean Scheduler is cleaning business management software for residential and commercial teams — scheduling, quotes, invoicing, online payments, and a branded customer portal.';

const SOFTWARE_DESCRIPTION =
  'Cleaning scheduling software to schedule crews, send quotes, accept online payments, and close the books — built for residential and commercial cleaning businesses.';

const COMPETITOR_URLS: Record<string, string> = {
  Jobber: 'https://www.getjobber.com',
  ZenMaid: 'https://zenmaid.com',
  Launch27: 'https://www.launch27.com',
  'Housecall Pro': 'https://www.housecallpro.com',
  Swept: 'https://www.sweptsoftware.com',
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type JsonLdNode = Record<string, unknown>;

function absoluteUrl(origin: string, path: string): string {
  return `${origin}${path}`;
}

function parseContentVerifiedDate(verified?: string): string {
  if (!verified) return new Date().toISOString().slice(0, 10);

  const monthYearMatch = verified.match(/^([A-Za-z]+)\s+(\d{4})$/);
  const normalized = monthYearMatch ? `${monthYearMatch[1]} 1, ${monthYearMatch[2]}` : verified;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp)
    ? new Date().toISOString().slice(0, 10)
    : new Date(timestamp).toISOString().slice(0, 10);
}

function buildOrganization(origin: string): JsonLdNode {
  const logoUrl = absoluteUrl(origin, ORGANIZATION_LOGO_PATH);

  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: PRODUCT_NAME,
    legalName: PRODUCT_NAME,
    url: origin,
    description: ORGANIZATION_DESCRIPTION,
    email: SUPPORT_EMAIL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${origin}/#logo`,
      url: logoUrl,
      contentUrl: logoUrl,
      caption: PRODUCT_NAME,
      width: 512,
      height: 512,
    },
    image: { '@id': `${origin}/#logo` },
    address: {
      '@type': 'PostalAddress',
      streetAddress: LEGAL_BUSINESS_ADDRESS.streetAddress,
      addressLocality: LEGAL_BUSINESS_ADDRESS.addressLocality,
      addressRegion: LEGAL_BUSINESS_ADDRESS.addressRegion,
      postalCode: LEGAL_BUSINESS_ADDRESS.postalCode,
      addressCountry: LEGAL_BUSINESS_ADDRESS.addressCountry,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        url: absoluteUrl(origin, '/help/contact'),
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'privacy',
        email: LEGAL_CONTACT_EMAIL,
        availableLanguage: ['English'],
      },
    ],
  };
}

function buildWebsite(origin: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: PRODUCT_NAME,
    url: origin,
    description: ORGANIZATION_DESCRIPTION,
    inLanguage: 'en-US',
    publisher: { '@id': `${origin}/#organization` },
    about: { '@id': `${origin}/#organization` },
  };
}

function buildCleanSchedulerSoftware(origin: string): JsonLdNode {
  const starterPrice = PLATFORM_TIER_ENTITLEMENTS.starter.monthlyPriceUsd;

  return {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': `${origin}/#software`,
    name: PRODUCT_NAME,
    description: SOFTWARE_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Cleaning business management software',
    operatingSystem: 'Web browser',
    browserRequirements: 'Requires JavaScript. Works in modern browsers.',
    url: origin,
    image: absoluteUrl(origin, '/marketing/og-home.png'),
    publisher: { '@id': `${origin}/#organization` },
    author: { '@id': `${origin}/#organization` },
    offers: {
      '@type': 'Offer',
      price: String(starterPrice),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      category: 'Subscription',
      description: `Starter plan from $${starterPrice}/month with a 7-day free trial`,
      url: absoluteUrl(origin, '/pricing'),
    },
  };
}

function buildBreadcrumbItems(page: SeoMarketingPage): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ name: 'Home', path: '/' }];

  if (page.path.startsWith('/compare/')) {
    items.push({ name: 'Compare', path: '/compare' });
  } else if (page.path.startsWith('/for/')) {
    items.push({ name: 'Solutions', path: '/for/residential-cleaning-companies' });
  } else if (page.path.startsWith('/features/')) {
    items.push({ name: 'Features', path: '/features/scheduling-and-dispatch' });
  }

  items.push({ name: page.headline, path: page.path });
  return items;
}

function buildBreadcrumbList(origin: string, pageUrl: string, items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(origin, item.path),
    })),
  };
}

function buildFaqPageNode(pageUrl: string, faq: MarketingFaqItem[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function buildArticleNode(
  page: SeoMarketingPage,
  pageUrl: string,
  pageId: string,
  origin: string,
  aboutIds: string[],
): JsonLdNode {
  const dateModified = parseContentVerifiedDate(page.comparisonTable?.lastVerified);

  return {
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    headline: page.headline,
    description: page.lead,
    inLanguage: 'en-US',
    author: { '@id': `${origin}/#organization` },
    publisher: { '@id': `${origin}/#organization` },
    dateModified,
    mainEntityOfPage: { '@id': pageId },
    about: aboutIds.map((id) => ({ '@id': id })),
  };
}

function buildCompetitorSoftware(pageUrl: string, competitorName: string): JsonLdNode {
  const competitorUrl = COMPETITOR_URLS[competitorName];

  return {
    '@type': 'SoftwareApplication',
    '@id': `${pageUrl}#competitor`,
    name: competitorName,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Cleaning business management software',
    ...(competitorUrl ? { url: competitorUrl, sameAs: competitorUrl } : {}),
  };
}

/** Structured data graph for SEO marketing pages (for, features, compare, why). */
export function buildSeoPageJsonLd(page: SeoMarketingPage, origin: string): JsonLdNode {
  const pageUrl = absoluteUrl(origin, page.path);
  const pageId = `${pageUrl}#webpage`;
  const cleanSchedulerId = `${origin}/#software`;
  const breadcrumbItems = buildBreadcrumbItems(page);

  const aboutIds = [cleanSchedulerId];
  const graph: JsonLdNode[] = [
    buildOrganization(origin),
    buildWebsite(origin),
    buildCleanSchedulerSoftware(origin),
    {
      '@type': 'WebPage',
      '@id': pageId,
      url: pageUrl,
      name: page.metaTitle,
      description: page.metaDescription,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${origin}/#website` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      mainEntity: { '@id': `${pageUrl}#article` },
    },
    buildBreadcrumbList(origin, pageUrl, breadcrumbItems),
    buildArticleNode(page, pageUrl, pageId, origin, aboutIds),
  ];

  if (page.comparisonTable) {
    const competitorNode = buildCompetitorSoftware(pageUrl, page.comparisonTable.competitorName);
    aboutIds.push(competitorNode['@id'] as string);
    graph.push(competitorNode);

    const cleanSchedulerNode = graph.find((node) => node['@id'] === cleanSchedulerId) as JsonLdNode;
    cleanSchedulerNode.isSimilarTo = { '@id': competitorNode['@id'] };

    const articleNode = graph.find((node) => node['@id'] === `${pageUrl}#article`) as JsonLdNode;
    articleNode.about = aboutIds.map((id) => ({ '@id': id }));
  }

  if (page.faq.length > 0) {
    graph.push(buildFaqPageNode(pageUrl, page.faq));
    const webPageNode = graph.find((node) => node['@id'] === pageId) as JsonLdNode;
    webPageNode.hasPart = { '@id': `${pageUrl}#faq` };
  }

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': graph,
  };
}

type HomePageInput = {
  title: string;
  description: string;
};

/** Homepage structured data: Organization, WebSite, SoftwareApplication, FAQ. */
export function buildHomePageJsonLd(
  origin: string,
  faq: MarketingFaqItem[],
  page: HomePageInput,
): JsonLdNode {
  const pageUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const pageId = `${pageUrl}/#webpage`;

  const graph: JsonLdNode[] = [
    buildOrganization(origin),
    buildWebsite(origin),
    buildCleanSchedulerSoftware(origin),
    {
      '@type': 'WebPage',
      '@id': pageId,
      url: `${pageUrl}/`,
      name: page.title,
      description: page.description,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${origin}/#website` },
      mainEntity: { '@id': `${origin}/#software` },
    },
  ];

  if (faq.length > 0) {
    graph.push(buildFaqPageNode(`${pageUrl}/`, faq));
    const webPageNode = graph.find((node) => node['@id'] === pageId) as JsonLdNode;
    webPageNode.hasPart = { '@id': `${pageUrl}/#faq` };
  }

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': graph,
  };
}

type PricingTierOffer = {
  tier: string;
  displayName: string;
  monthlyPriceUsd: number;
};

/** Pricing page structured data with tiered SoftwareApplication offers. */
export function buildPricingPageJsonLd(origin: string, tiers: PricingTierOffer[]): JsonLdNode {
  const pageUrl = absoluteUrl(origin, '/pricing');
  const pageId = `${pageUrl}#webpage`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      buildOrganization(origin),
      buildWebsite(origin),
      {
        '@type': 'WebPage',
        '@id': pageId,
        url: pageUrl,
        name: 'Clean Scheduler pricing',
        description:
          'Starter, Business, and Pro plans for residential and commercial cleaning businesses.',
        inLanguage: 'en-US',
        isPartOf: { '@id': `${origin}/#website` },
        mainEntity: { '@id': `${pageUrl}#software` },
      },
      {
        '@type': ['SoftwareApplication', 'WebApplication'],
        '@id': `${pageUrl}#software`,
        name: PRODUCT_NAME,
        description: SOFTWARE_DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Cleaning business management software',
        operatingSystem: 'Web browser',
        browserRequirements: 'Requires JavaScript. Works in modern browsers.',
        url: origin,
        image: absoluteUrl(origin, '/marketing/og-home.png'),
        publisher: { '@id': `${origin}/#organization` },
        author: { '@id': `${origin}/#organization` },
        offers: tiers.map((tier) => ({
          '@type': 'Offer',
          name: `${tier.displayName} plan`,
          price: String(tier.monthlyPriceUsd),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          category: 'Subscription',
          description: `${tier.displayName} — $${tier.monthlyPriceUsd}/month`,
          url: pageUrl,
        })),
      },
      buildBreadcrumbList(origin, pageUrl, [
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/pricing' },
      ]),
    ],
  };
}

export type HelpGuideJsonLdHub = {
  backHref: string;
  breadcrumbLabel: string;
};

/** Structured data graph for owner/customer help guide articles. */
export function buildHelpGuideJsonLd(
  article: HelpGuideArticle,
  origin: string,
  hub: HelpGuideJsonLdHub,
): JsonLdNode {
  const pageUrl = absoluteUrl(origin, article.path);
  const pageId = `${pageUrl}#webpage`;

  const graph: JsonLdNode[] = [
    buildOrganization(origin),
    buildWebsite(origin),
    {
      '@type': 'WebPage',
      '@id': pageId,
      url: pageUrl,
      name: article.title,
      description: article.description,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${origin}/#website` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      mainEntity: { '@id': `${pageUrl}#article` },
    },
    buildBreadcrumbList(origin, pageUrl, [
      { name: 'Home', path: '/' },
      { name: 'Help', path: '/help' },
      { name: hub.breadcrumbLabel, path: hub.backHref },
      { name: article.title, path: article.path },
    ]),
    {
      '@type': 'Article',
      '@id': `${pageUrl}#article`,
      headline: article.title,
      description: article.description,
      inLanguage: 'en-US',
      author: { '@id': `${origin}/#organization` },
      publisher: { '@id': `${origin}/#organization` },
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntityOfPage: { '@id': pageId },
      about: { '@id': `${origin}/#software` },
    },
  ];

  if (article.faq.length > 0) {
    graph.push(buildFaqPageNode(pageUrl, article.faq));
    const webPageNode = graph.find((node) => node['@id'] === pageId) as JsonLdNode;
    webPageNode.hasPart = { '@id': `${pageUrl}#faq` };
  }

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': graph,
  };
}

type CompareHubPage = Pick<
  SeoMarketingPage,
  'path' | 'headline' | 'lead' | 'metaTitle' | 'metaDescription'
>;

/** Structured data for the /compare hub listing all comparison articles. */
export function buildCompareHubJsonLd(
  pages: CompareHubPage[],
  origin: string,
  hub: { title: string; description: string },
): JsonLdNode {
  return buildCollectionHubJsonLd('/compare', 'Compare', pages, origin, hub, {
    itemListId: '#itemlist',
    itemListName: 'Clean Scheduler software comparisons',
  });
}

type FeatureHubPage = Pick<
  SeoMarketingPage,
  'path' | 'headline' | 'lead' | 'metaTitle' | 'metaDescription'
>;

/** Structured data for the /features hub listing all feature pages. */
export function buildFeatureHubJsonLd(
  pages: FeatureHubPage[],
  origin: string,
  hub: { title: string; description: string },
): JsonLdNode {
  return buildCollectionHubJsonLd('/features', 'Features', pages, origin, hub, {
    itemListId: '#itemlist',
    itemListName: 'Clean Scheduler product features',
  });
}

function buildCollectionHubJsonLd(
  hubPath: string,
  breadcrumbLabel: string,
  pages: CompareHubPage[],
  origin: string,
  hub: { title: string; description: string },
  itemList: { itemListId: string; itemListName: string },
): JsonLdNode {
  const pageUrl = absoluteUrl(origin, hubPath);
  const pageId = `${pageUrl}#webpage`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      buildOrganization(origin),
      buildWebsite(origin),
      {
        '@type': 'CollectionPage',
        '@id': pageId,
        url: pageUrl,
        name: hub.title,
        description: hub.description,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${origin}/#website` },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        mainEntity: { '@id': `${pageUrl}${itemList.itemListId}` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: origin,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: breadcrumbLabel,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}${itemList.itemListId}`,
        name: itemList.itemListName,
        itemListElement: pages.map((page, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: page.headline,
          url: absoluteUrl(origin, page.path),
          description: page.lead,
        })),
      },
    ],
  };
}
