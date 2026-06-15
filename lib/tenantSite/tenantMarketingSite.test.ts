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
