import { describe, expect, it } from 'vitest';
import { CLEANING_BUSINESS_ARTICLES } from '@/lib/marketing/seoContent/helpArticles';
import { COMPARE_PAGES, FEATURE_PAGES } from '@/lib/marketing/seoContent/marketingPages';
import {
  buildCompareHubJsonLd,
  buildFeatureHubJsonLd,
  buildHelpGuideJsonLd,
  buildHomePageJsonLd,
  buildPricingPageJsonLd,
  buildSeoPageJsonLd,
} from '@/lib/marketing/seoJsonLd';

const ORIGIN = 'https://cleanscheduler.com';

function graphNodes(jsonLd: Record<string, unknown>) {
  return jsonLd['@graph'] as Array<Record<string, unknown>>;
}

function nodeById(jsonLd: Record<string, unknown>, id: string) {
  return graphNodes(jsonLd).find((node) => node['@id'] === id);
}

function includesType(node: Record<string, unknown> | undefined, type: string) {
  const value = node?.['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}

describe('buildSeoPageJsonLd', () => {
  it('includes comparison software entities for competitor pages', () => {
    const page = COMPARE_PAGES.find((entry) => entry.slug === 'vs-jobber');
    expect(page).toBeDefined();

    const jsonLd = buildSeoPageJsonLd(page!, ORIGIN);
    const graph = graphNodes(jsonLd);

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(graph.some((node) => node['@type'] === 'WebPage')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'Article')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'FAQPage')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);

    const cleanScheduler = nodeById(jsonLd, `${ORIGIN}/#software`);
    const competitor = nodeById(jsonLd, `${ORIGIN}/compare/vs-jobber#competitor`);

    expect(includesType(cleanScheduler, 'SoftwareApplication')).toBe(true);
    expect(includesType(competitor, 'SoftwareApplication')).toBe(true);
    expect(includesType(competitor, 'WebApplication')).toBe(true);
    expect(competitor?.name).toBe('Jobber');
    expect(competitor?.applicationCategory).toBe('BusinessApplication');
    expect(competitor?.operatingSystem).toBe('Web browser');
    expect(cleanScheduler?.isSimilarTo).toEqual({
      '@id': `${ORIGIN}/compare/vs-jobber#competitor`,
    });
  });

  it('gives competitor SoftwareApplication the minimum Google-required fields', () => {
    const page = COMPARE_PAGES.find((entry) => entry.slug === 'vs-launch27');
    expect(page).toBeDefined();

    const competitor = nodeById(
      buildSeoPageJsonLd(page!, ORIGIN),
      `${ORIGIN}/compare/vs-launch27#competitor`,
    );

    expect(competitor?.name).toBe('Launch27');
    expect(competitor?.applicationCategory).toBe('BusinessApplication');
    expect(competitor?.operatingSystem).toBe('Web browser');
    expect(competitor?.offers).toBeUndefined();
    expect(competitor?.aggregateRating).toBeUndefined();
  });

  it('omits competitor software on non-comparison pages', () => {
    const page = COMPARE_PAGES.find((entry) => entry.slug === 'spreadsheets-and-texts');
    expect(page).toBeDefined();

    const jsonLd = buildSeoPageJsonLd(page!, ORIGIN);
    const graph = graphNodes(jsonLd);

    expect(
      graph.some((node) => node['@id'] === `${ORIGIN}/compare/spreadsheets-and-texts#competitor`),
    ).toBe(false);
    expect(graph.some((node) => includesType(node, 'SoftwareApplication'))).toBe(true);
  });
});

describe('buildHomePageJsonLd', () => {
  it('includes enriched Organization, WebSite, SoftwareApplication, and FAQ', () => {
    const jsonLd = buildHomePageJsonLd(ORIGIN, [{ question: 'Q?', answer: 'A.' }], {
      title: 'Home',
      description: 'Cleaning software.',
    });
    const graph = graphNodes(jsonLd);
    const organization = nodeById(jsonLd, `${ORIGIN}/#organization`);
    const website = nodeById(jsonLd, `${ORIGIN}/#website`);
    const software = nodeById(jsonLd, `${ORIGIN}/#software`);
    const logo = organization?.logo as Record<string, unknown> | undefined;
    const address = organization?.address as Record<string, unknown> | undefined;
    const contactPoints = organization?.contactPoint as Array<Record<string, unknown>>;

    expect(organization?.['@type']).toBe('Organization');
    expect(organization?.email).toBe('support@cleanscheduler.com');
    expect(logo?.['@type']).toBe('ImageObject');
    expect(logo?.url).toBe(`${ORIGIN}/favicon/web-app-manifest-512x512.png`);
    expect(address?.addressLocality).toBe('Casper');
    expect(address?.addressRegion).toBe('WY');
    expect(address?.postalCode).toBe('82609');
    expect(contactPoints).toHaveLength(2);

    expect(website?.['@type']).toBe('WebSite');
    expect(website?.publisher).toEqual({ '@id': `${ORIGIN}/#organization` });
    expect(website?.inLanguage).toBe('en-US');

    expect(includesType(software, 'SoftwareApplication')).toBe(true);
    expect(includesType(software, 'WebApplication')).toBe(true);
    expect(software?.publisher).toEqual({ '@id': `${ORIGIN}/#organization` });
    expect(software?.description).toContain('Cleaning scheduling software');
    expect((software?.offers as Record<string, unknown>)?.availability).toBe(
      'https://schema.org/InStock',
    );

    expect(graph.some((node) => node['@type'] === 'FAQPage')).toBe(true);
  });
});

describe('buildPricingPageJsonLd', () => {
  it('includes tiered offers', () => {
    const jsonLd = buildPricingPageJsonLd(ORIGIN, [
      { tier: 'starter', displayName: 'Starter', monthlyPriceUsd: 39 },
      { tier: 'business', displayName: 'Business', monthlyPriceUsd: 129 },
    ]);
    const software = nodeById(jsonLd, `${ORIGIN}/pricing#software`);
    const offers = software?.offers as Array<Record<string, unknown>>;

    expect(offers).toHaveLength(2);
    expect(offers[0]?.price).toBe('39');
  });
});

describe('buildHelpGuideJsonLd', () => {
  it('emits Article, BreadcrumbList, and FAQPage for help guides', () => {
    const article = CLEANING_BUSINESS_ARTICLES.find(
      (entry) => entry.slug === 'how-to-get-commercial-cleaning-accounts',
    );
    expect(article).toBeDefined();

    const jsonLd = buildHelpGuideJsonLd(article!, ORIGIN, {
      backHref: '/help/cleaning-businesses',
      breadcrumbLabel: 'Cleaning businesses',
    });
    const graph = graphNodes(jsonLd);

    expect(graph.some((node) => node['@type'] === 'Article')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'FAQPage')).toBe(true);

    const articleNode = nodeById(jsonLd, `${ORIGIN}${article!.path}#article`);
    expect(articleNode?.headline).toBe('How to get commercial cleaning accounts');
  });
});

describe('buildCompareHubJsonLd', () => {
  it('lists all comparison pages in an ItemList', () => {
    const jsonLd = buildCompareHubJsonLd(COMPARE_PAGES, ORIGIN, {
      title: 'Compare Clean Scheduler',
      description: 'Software comparisons for cleaning businesses.',
    });

    const itemList = nodeById(jsonLd, `${ORIGIN}/compare#itemlist`);
    const items = itemList?.itemListElement as Array<Record<string, unknown>>;

    expect(itemList?.['@type']).toBe('ItemList');
    expect(items).toHaveLength(COMPARE_PAGES.length);
    expect(items[0]?.url).toBe(`${ORIGIN}${COMPARE_PAGES[0]!.path}`);
  });
});

describe('buildFeatureHubJsonLd', () => {
  it('lists all feature pages in an ItemList', () => {
    const jsonLd = buildFeatureHubJsonLd(FEATURE_PAGES, ORIGIN, {
      title: 'Features',
      description: 'Cleaning business software features.',
    });

    const itemList = nodeById(jsonLd, `${ORIGIN}/features#itemlist`);
    const items = itemList?.itemListElement as Array<Record<string, unknown>>;

    expect(itemList?.['@type']).toBe('ItemList');
    expect(items).toHaveLength(FEATURE_PAGES.length);
    expect(items[0]?.url).toBe(`${ORIGIN}${FEATURE_PAGES[0]!.path}`);
  });
});
