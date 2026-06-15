import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoContentLink, SeoPageSection } from '@/lib/marketing/seoContent/types';

export type TenantMarketingPageType =
  | 'home'
  | 'services'
  | 'about'
  | 'contact'
  | 'faq'
  | 'service_area'
  | 'custom';

export type TenantMarketingPageStatus = 'draft' | 'published';

export type TenantMarketingLeadStatus = 'new' | 'contacted' | 'converted' | 'closed';

export type TenantMarketingLeadSource = 'contact_form' | 'quote_request';

export type TenantPublicDomainSiteMode = 'portal_only' | 'unified';

export type TenantSitePageContent = {
  slug: string;
  pageType: TenantMarketingPageType;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  eyebrow: string;
  headline: string;
  lead: string;
  sections: SeoPageSection[];
  faq: MarketingFaqItem[];
  relatedLinks: SeoContentLink[];
  ctaTitle: string | null;
  ctaLead: string | null;
  locationName: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type TenantSiteSettings = {
  isPublished: boolean;
  homepageSlug: string;
  defaultCtaLabel: string;
  defaultCtaHref: string;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceAreaSummary: string | null;
};

export type TenantSiteBranding = {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
  slug: string;
};

export type TenantSiteContext = {
  tenantId: string;
  branding: TenantSiteBranding;
  settings: TenantSiteSettings;
  /** Public origin without trailing slash */
  origin: string;
  /** True when served from unified custom domain (paths omit /site prefix) */
  unifiedDomain: boolean;
  portalLoginHref: string;
  indexable: boolean;
};

export type TenantSiteNavLink = {
  href: string;
  label: string;
};
