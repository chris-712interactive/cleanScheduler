import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@/lib/legal/site';

export const DEFAULT_OG_IMAGE = {
  url: '/marketing/og-home.png',
  width: 1280,
  height: 800,
  alt: 'Clean Scheduler dashboard for cleaning businesses',
};

type MarketingMetadataInput = {
  path: string;
  title: string;
  description: string;
  noIndex?: boolean;
  ogType?: 'website' | 'article';
};

/** Consistent canonical, Open Graph, and Twitter metadata for public marketing pages. */
export function buildMarketingPageMetadata({
  path,
  title,
  description,
  noIndex = false,
  ogType = 'website',
}: MarketingMetadataInput): Metadata {
  const resolvedTitle = title.includes(PRODUCT_NAME) ? title : title;

  return {
    title: resolvedTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: resolvedTitle,
      description,
      type: ogType,
      siteName: PRODUCT_NAME,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Auth and utility flows that should not compete in search results. */
export const NOINDEX_PAGE_METADATA: Metadata = {
  robots: { index: false, follow: true },
};
