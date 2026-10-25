import { describe, expect, it } from 'vitest';
import {
  PLATFORM_TIER_ENTITLEMENTS,
  TRIAL_ENTITLEMENTS,
  isFeatureEnabled,
} from '@/lib/billing/entitlements';
import { isTenantSiteIndexable } from '@/lib/tenantSite/indexingPolicy';
import { buildTenantSitePageJsonLd } from '@/lib/marketing/tenantSiteJsonLd';
import { publicPathForSitePage } from '@/lib/tenantSite/loadTenantSiteData';

describe('tenant marketing site entitlements', () => {
  it('enables CMS on Business and Pro', () => {
    expect(isFeatureEnabled('business', 'tenantMarketingSite')).toBe(true);
    expect(isFeatureEnabled('pro', 'tenantMarketingSite')).toBe(true);
    expect(isFeatureEnabled('starter', 'tenantMarketingSite')).toBe(false);
  });

  it('enables unified custom domain on Pro only', () => {
    expect(isFeatureEnabled('pro', 'tenantMarketingSiteCustomDomain')).toBe(true);
    expect(isFeatureEnabled('business', 'tenantMarketingSiteCustomDomain')).toBe(false);
  });

  it('applies page limits per tier', () => {
    expect(PLATFORM_TIER_ENTITLEMENTS.business.limits.maxMarketingSitePages).toBe(10);
    expect(PLATFORM_TIER_ENTITLEMENTS.pro.limits.maxMarketingSitePages).toBe(50);
    expect(TRIAL_ENTITLEMENTS.limits.maxMarketingSitePages).toBe(2);
  });
});

describe('tenant site indexing policy', () => {
  it('blocks trial and unpublished sites from indexing', () => {
    expect(
      isTenantSiteIndexable({
        plan: 'trial',
        billingStatus: 'trialing',
        isPublished: true,
      }),
    ).toBe(false);

    expect(
      isTenantSiteIndexable({
        plan: 'business',
        billingStatus: 'active',
        isPublished: false,
      }),
    ).toBe(false);

    expect(
      isTenantSiteIndexable({
        plan: 'business',
        billingStatus: 'active',
        isPublished: true,
      }),
    ).toBe(true);
  });
});

describe('tenant site public paths', () => {
  it('uses /site prefix on platform-hosted URLs', () => {
    expect(publicPathForSitePage('home', false)).toBe('/site');
    expect(publicPathForSitePage('contact', false)).toBe('/site/contact');
  });

  it('uses root paths on unified domains', () => {
    expect(publicPathForSitePage('home', true)).toBe('/');
    expect(publicPathForSitePage('contact', true)).toBe('/contact');
  });
});

describe('tenant site theme', () => {
  it('resolves brand color scheme from tenant settings', async () => {
    const { resolveTenantSiteAccentColor, resolveTenantSiteThemeStyle } =
      await import('@/lib/tenantSite/siteTheme');

    expect(resolveTenantSiteAccentColor('brand', '#ff0000')).toBe('#ff0000');
    expect(resolveTenantSiteAccentColor('ocean', '#ff0000')).toBe('#0284c7');
    expect(resolveTenantSiteThemeStyle('modern', 'forest', '#123456')).toMatchObject({
      '--tenant-brand': '#059669',
    });
  });
});

describe('tenant site navigation labels', () => {
  it('uses short preset labels instead of page headlines', async () => {
    const { buildTenantSiteNavPages, resolveTenantSiteNavLabel } =
      await import('@/lib/tenantSite/navLabels');

    expect(
      resolveTenantSiteNavLabel({
        pageType: 'home',
        slug: 'home',
        headline: 'A cleaner space, without the hassle',
        metaTitle: 'Professional cleaning services',
        sortOrder: 0,
      }),
    ).toBe('Home');

    const primary = buildTenantSiteNavPages(
      [
        {
          slug: 'home',
          page_type: 'home',
          headline: 'A cleaner space, without the hassle',
          meta_title: 'Professional cleaning services',
          location_name: null,
          city: null,
          sort_order: 0,
        },
        {
          slug: 'fort-myers',
          page_type: 'service_area',
          headline: 'Cleaning in Fort Myers',
          meta_title: 'Cleaning in Fort Myers, FL',
          location_name: 'Fort Myers',
          city: 'Fort Myers',
          sort_order: 4,
        },
      ],
      { primaryOnly: true },
    );

    expect(primary.map((row) => row.label)).toEqual(['Home']);
    expect(
      resolveTenantSiteNavLabel({
        pageType: 'custom',
        slug: 'service-area-fort-myers',
        headline: 'Cleaning in Fort Myers',
        metaTitle: 'service-area-fort-myers',
        sortOrder: 4,
      }),
    ).toBe('Service Area Fort Myers');
  });
});

describe('tenant site JSON-LD', () => {
  const page = {
    slug: 'home',
    pageType: 'home' as const,
    metaTitle: 'Cleaning services',
    metaDescription: 'Professional cleaning',
    ogImageUrl: null,
    eyebrow: 'Cleaning',
    headline: 'We clean homes',
    lead: 'Trusted local cleaners',
    sections: [
      {
        title: 'Recurring home cleaning',
        paragraphs: ['Weekly maintenance for kitchens and bathrooms.'],
      },
    ],
    faq: [{ question: 'Do you bring supplies?', answer: 'Yes.' }],
    relatedLinks: [],
    ctaTitle: null,
    ctaLead: null,
    locationName: null,
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
  };

  it('emits HouseCleaner, services, and FAQ entities on the canonical URL', () => {
    const json = buildTenantSitePageJsonLd(
      page,
      'https://acme.example.com/site',
      { tenantName: 'Acme Cleaning', logoUrl: null, brandColor: '#0D9488', slug: 'acme' },
      {
        homepageSlug: 'home',
        contactEmail: 'hello@acme.com',
        contactPhone: '512-555-0100',
        serviceAreaSummary: 'Austin metro',
      },
    );

    const graph = (json as { '@graph': Array<Record<string, unknown>> })['@graph'];
    const business = graph.find((node) => node['@type'] === 'HouseCleaner');
    expect(business?.url).toBe('https://acme.example.com/site');
    expect(business?.hasOfferCatalog).toBeTruthy();
    expect(graph.some((node) => node['@type'] === 'FAQPage')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(false);
  });

  it('canonicalizes inner pages without doubling the /site prefix', () => {
    const json = buildTenantSitePageJsonLd(
      { ...page, slug: 'contact', pageType: 'contact', sections: [], faq: [] },
      'https://acme.example.com/site',
      { tenantName: 'Acme Cleaning', logoUrl: null, brandColor: '#0D9488', slug: 'acme' },
      { homepageSlug: 'home' },
    );
    const graph = (json as { '@graph': Array<Record<string, unknown>> })['@graph'];
    const webPage = graph.find((node) => node['@type'] === 'WebPage');
    expect(webPage?.url).toBe('https://acme.example.com/site/contact');
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);
  });
});

describe('tenant site canonical URLs', () => {
  it('uses the site root for the homepage on platform and custom domains', async () => {
    const { buildTenantSitePublicUrl, resolveTenantSiteHref } =
      await import('@/lib/tenantSite/publicPaths');

    expect(buildTenantSitePublicUrl('https://acme.example.com/site', 'home', 'home')).toBe(
      'https://acme.example.com/site',
    );
    expect(buildTenantSitePublicUrl('https://acme.example.com/site', 'services', 'home')).toBe(
      'https://acme.example.com/site/services',
    );
    expect(buildTenantSitePublicUrl('https://www.acme.com', 'contact', 'home')).toBe(
      'https://www.acme.com/contact',
    );
    expect(resolveTenantSiteHref('/contact', false)).toBe('/site/contact');
    expect(resolveTenantSiteHref('/site/services', true)).toBe('/services');
  });
});

describe('tenant site metadata', () => {
  it('sets an absolute title and does not borrow the platform share image', async () => {
    const { buildTenantSitePageMetadata } = await import('@/lib/marketing/tenantSiteMetadata');
    const metadata = buildTenantSitePageMetadata({
      canonicalUrl: 'https://acme.example.com/site/services',
      title: 'Cleaning services',
      description: 'Recurring and one-time cleaning.',
      tenantName: 'Acme Cleaning',
    });

    expect(metadata.title).toEqual({ absolute: 'Cleaning services | Acme Cleaning' });
    expect(metadata.alternates).toEqual({
      canonical: 'https://acme.example.com/site/services',
    });
    expect(metadata.openGraph?.siteName).toBe('Acme Cleaning');
    expect(metadata.openGraph?.images).toEqual([]);
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });
});

describe('tenant site robots', () => {
  it('allows only the marketing path on a platform host', async () => {
    const { buildTenantSiteRobots, formatRobotsTxt } =
      await import('@/lib/tenantSite/robotsPolicy');
    const robots = buildTenantSiteRobots({
      indexable: true,
      unifiedDomain: false,
      sitemapUrl: 'https://acme.example.com/sitemap.xml',
    });
    expect(formatRobotsTxt(robots)).toContain('Allow: /site');
    expect(formatRobotsTxt(robots)).toContain('Disallow: /');
    expect(formatRobotsTxt(robots)).toContain('Sitemap: https://acme.example.com/sitemap.xml');
  });

  it('blocks the customer portal on a unified domain and hides unpublished sites', async () => {
    const { buildTenantSiteRobots } = await import('@/lib/tenantSite/robotsPolicy');
    expect(buildTenantSiteRobots({ indexable: true, unifiedDomain: true }).rules.disallow).toEqual([
      '/portal',
      '/api/',
    ]);
    expect(
      buildTenantSiteRobots({ indexable: false, unifiedDomain: true }).sitemap,
    ).toBeUndefined();
  });
});

describe('tenant site host classification', () => {
  it('keeps apex robots on the platform and tenant hosts on the tenant', async () => {
    const { classifySeoHost } = await import('@/lib/tenantSite/classifySeoHost');
    expect(classifySeoHost('cleanscheduler.com', 'cleanscheduler.com').kind).toBe('platform');
    expect(classifySeoHost('www.cleanscheduler.com', 'cleanscheduler.com').kind).toBe('platform');
    expect(classifySeoHost('acme.cleanscheduler.com', 'cleanscheduler.com')).toEqual({
      kind: 'tenant-subdomain',
      tenantSlug: 'acme',
    });
    expect(classifySeoHost('www.acme.com', 'cleanscheduler.com')).toEqual({
      kind: 'custom-domain',
      hostname: 'www.acme.com',
    });
  });
});

describe('default tenant site templates', () => {
  it('names the city and links the core pages', async () => {
    const { buildDefaultTenantSiteTemplates } = await import('@/lib/marketing/tenantSiteTemplates');
    const pages = buildDefaultTenantSiteTemplates({
      businessName: 'Acme Cleaning',
      city: 'Austin',
      state: 'TX',
    });

    expect(pages.map((page) => page.slug)).toEqual(['home', 'services', 'about', 'faq', 'contact']);
    expect(pages[0]?.metaTitle).toContain('Austin, TX');
    expect(pages[0]?.metaDescription).toContain('Acme Cleaning');
    expect(pages[0]?.relatedLinks.map((link) => link.href)).toContain('/contact');
    expect(pages.find((page) => page.slug === 'faq')?.faq.length).toBeGreaterThan(3);
  });
});
