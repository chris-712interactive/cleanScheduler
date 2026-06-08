import { ALL_SEO_MARKETING_PAGES, WHY_CLEANSCHEDULER_PAGE } from './marketingPages';
import { CLEANING_BUSINESS_ARTICLES, CLEANING_BUSINESS_HUB } from './helpArticles';
import { CUSTOMER_HELP_ARTICLES, CUSTOMER_HELP_HUB } from './customerHelpArticles';
import type { SeoMarketingPage } from './types';

export { ALL_SEO_MARKETING_PAGES, WHY_CLEANSCHEDULER_PAGE };
export { CLEANING_BUSINESS_ARTICLES, CLEANING_BUSINESS_HUB };
export { CUSTOMER_HELP_ARTICLES, CUSTOMER_HELP_HUB };
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

  const customerHelpArticles = CUSTOMER_HELP_ARTICLES.map((article) => ({
    path: article.path,
    priority: article.sitemapPriority,
    changeFrequency: article.changeFrequency,
  }));

  return [...marketing, helpHub, ...helpArticles, ...customerHelpArticles];
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
    },
  };
}
