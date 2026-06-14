import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { PRODUCT_NAME } from '@/lib/legal/site';
import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoMarketingPage } from '@/lib/marketing/seoContent/types';

const SCHEMA_CONTEXT = 'https://schema.org';

const COMPETITOR_URLS: Record<string, string> = {
  Jobber: 'https://www.getjobber.com',
  ZenMaid: 'https://zenmaid.com',
  Launch27: 'https://www.launch27.com',
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
  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: PRODUCT_NAME,
    url: origin,
  };
}

function buildWebsite(origin: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: PRODUCT_NAME,
    url: origin,
    publisher: { '@id': `${origin}/#organization` },
  };
}

function buildCleanSchedulerSoftware(origin: string): JsonLdNode {
  const starterPrice = PLATFORM_TIER_ENTITLEMENTS.starter.monthlyPriceUsd;

  return {
    '@type': 'SoftwareApplication',
    '@id': `${origin}/#software`,
    name: PRODUCT_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Cleaning business management software',
    operatingSystem: 'Web browser',
    url: origin,
    offers: {
      '@type': 'Offer',
      price: String(starterPrice),
      priceCurrency: 'USD',
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
  const pageUrl = absoluteUrl(origin, '/compare');
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
        mainEntity: { '@id': `${pageUrl}#itemlist` },
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
            name: 'Compare',
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#itemlist`,
        name: 'Clean Scheduler software comparisons',
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
