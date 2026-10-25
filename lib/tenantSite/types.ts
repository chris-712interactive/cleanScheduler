import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';
import type { SeoContentLink, SeoPageSection } from '@/lib/marketing/seoContent/types';
import type { TenantSiteColorScheme, TenantSiteTemplate } from '@/lib/tenantSite/siteTheme';

export type TenantMarketingPageType =
  'home' | 'services' | 'about' | 'contact' | 'faq' | 'service_area' | 'custom';

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
  siteTemplate: TenantSiteTemplate;
  colorScheme: TenantSiteColorScheme;
};

export type TenantSiteBranding = {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
  slug: string;
};

/** Business identity used for NAP, hours, and LocalBusiness structured data. */
export type TenantSiteProfile = {
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Schema.org day names, e.g. Monday. */
  openingDays: string[];
  /** 24-hour HH:MM */
  opens: string | null;
  /** 24-hour HH:MM */
  closes: string | null;
};

export type TenantSiteContext = {
  tenantId: string;
  branding: TenantSiteBranding;
  settings: TenantSiteSettings;
  profile: TenantSiteProfile;
  /** Canonical public origin without trailing slash (`https://host` or `https://host/site`) */
  origin: string;
  /** True when this request is served from a unified custom domain (paths omit /site) */
  unifiedDomain: boolean;
  portalLoginHref: string;
  indexable: boolean;
};

export type TenantSiteNavLink = {
  href: string;
  label: string;
};
