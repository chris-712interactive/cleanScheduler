import { ALL_SEO_MARKETING_PAGES, WHY_CLEANSCHEDULER_PAGE } from './marketingPages';
import { CLEANING_BUSINESS_ARTICLES, CLEANING_BUSINESS_HUB } from './helpArticles';
import { CUSTOMER_HELP_ARTICLES, CUSTOMER_HELP_HUB } from './customerHelpArticles';
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/marketingPageMetadata';
import type { SeoMarketingPage } from './types';

export { ALL_SEO_MARKETING_PAGES, WHY_CLEANSCHEDULER_PAGE };
export { CLEANING_BUSINESS_ARTICLES, CLEANING_BUSINESS_HUB };
export { CUSTOMER_HELP_ARTICLES, CUSTOMER_HELP_HUB };
export { COMPETITOR_COMPARE_PAGES } from './competitorComparePages';
export * from './marketingPages';
export * from './helpArticles';
export * from './customerHelpArticles';
export type * from './types';

export function getAllPublicSeoPaths(): Array<{
  path: string;
  priority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
}> {
  const marketing = ALL_SEO_MARKETING_PAGES.map((page) => ({
    path: page.path,
    priority: page.sitemapPriority,
    changeFrequency: page.changeFrequency,
  }));

  const helpHub = {
    path: CLEANING_BUSINESS_HUB.path,
    priority: 0.6,
    changeFrequency: 'monthly' as const,
  };

  const helpArticles = CLEANING_BUSINESS_ARTICLES.map((article) => ({
    path: article.path,
    priority: article.sitemapPriority,
    changeFrequency: article.changeFrequency,
  }));

  return [...marketing, helpHub, ...helpArticles];
}

export function buildPageMetadata(page: SeoMarketingPage) {
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: 'article' as const,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: page.metaTitle,
      description: page.metaDescription,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}
