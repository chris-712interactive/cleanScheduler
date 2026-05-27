import type { Metadata } from 'next';
import type { HelpArticleEntry } from './types';

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
    },
  };
}
