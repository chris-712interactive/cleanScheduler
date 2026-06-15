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
  });
});

describe('tenant site JSON-LD', () => {
  it('emits LocalBusiness and FAQ entities', () => {
    const json = buildTenantSitePageJsonLd(
      {
        slug: 'home',
        pageType: 'home',
        metaTitle: 'Cleaning services',
        metaDescription: 'Professional cleaning',
        ogImageUrl: null,
        eyebrow: 'Cleaning',
        headline: 'We clean homes',
        lead: 'Trusted local cleaners',
        sections: [],
        faq: [{ question: 'Do you bring supplies?', answer: 'Yes.' }],
        relatedLinks: [],
        ctaTitle: null,
        ctaLead: null,
        locationName: null,
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
      'https://acme.example.com',
      { tenantName: 'Acme Cleaning', logoUrl: null, brandColor: '#0D9488', slug: 'acme' },
      {
        contactEmail: 'hello@acme.com',
        contactPhone: '512-555-0100',
        serviceAreaSummary: 'Austin metro',
      },
    );

    const graph = (json as { '@graph': Array<{ '@type': string }> })['@graph'];
    expect(graph.some((node) => node['@type'] === 'LocalBusiness')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'FAQPage')).toBe(true);
  });
});
