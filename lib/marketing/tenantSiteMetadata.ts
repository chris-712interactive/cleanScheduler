import type { Metadata } from 'next';
import { buildMarketingPageMetadata } from '@/lib/marketing/marketingPageMetadata';

type TenantSiteMetadataInput = {
  origin: string;
  path: string;
  title: string;
  description: string;
  tenantName: string;
  ogImageUrl?: string | null;
  noIndex?: boolean;
};

export function buildTenantSitePageMetadata({
  origin,
  path,
  title,
  description,
  tenantName,
  ogImageUrl,
  noIndex = false,
}: TenantSiteMetadataInput): Metadata {
  const resolvedTitle = title.includes(tenantName) ? title : `${title} | ${tenantName}`;
  const canonicalPath = path.startsWith('/') ? path : `/${path}`;
  const base = buildMarketingPageMetadata({
    path: canonicalPath,
    title: resolvedTitle,
    description,
    noIndex,
  });

  const ogImages = ogImageUrl
    ? [{ url: ogImageUrl, width: 1200, height: 630, alt: tenantName }]
    : base.openGraph?.images;

  return {
    ...base,
    metadataBase: new URL(origin),
    alternates: { canonical: `${origin}${canonicalPath === '/site' ? '' : canonicalPath}` },
    openGraph: {
      ...base.openGraph,
      url: `${origin}${canonicalPath}`,
      images: ogImages,
    },
    twitter: {
      ...base.twitter,
      images: ogImageUrl ? [ogImageUrl] : base.twitter?.images,
    },
  };
}
