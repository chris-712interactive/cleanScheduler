import type { MarketingFaqItem } from '@/lib/marketing/homepageContent';

export type SeoContentLink = {
  href: string;
  label: string;
};

export type SeoPageSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  link?: SeoContentLink;
};

export type SeoComparisonRow = {
  feature: string;
  cleanScheduler: string;
  competitor: string;
};

export type SeoComparisonTable = {
  competitorName: string;
  lastVerified: string;
  rows: SeoComparisonRow[];
};

export type SeoMarketingPage = {
  slug: string;
  path: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  lead: string;
  sections: SeoPageSection[];
  comparisonTable?: SeoComparisonTable;
  faq: MarketingFaqItem[];
  relatedLinks: SeoContentLink[];
  ctaTitle?: string;
  ctaLead?: string;
  sitemapPriority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
};

export type HelpGuideFigure = {
  src: string;
  alt: string;
  caption?: string;
};

export type HelpGuideSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tip?: string;
  figures?: HelpGuideFigure[];
};

export type HelpGuideArticle = {
  slug: string;
  path: string;
  title: string;
  description: string;
  sections: HelpGuideSection[];
  faq: MarketingFaqItem[];
  relatedLinks: SeoContentLink[];
  sitemapPriority: number;
  changeFrequency: 'monthly' | 'yearly';
};
