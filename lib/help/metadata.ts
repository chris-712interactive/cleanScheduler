import type { Metadata } from 'next';
import type { HelpArticleEntry } from './types';
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/marketingPageMetadata';
import { PRODUCT_NAME } from '@/lib/legal/site';

export function buildHelpPageMetadata(article: HelpArticleEntry): Metadata {
  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: article.path,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      siteName: PRODUCT_NAME,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}
