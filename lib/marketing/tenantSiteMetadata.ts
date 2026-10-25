import type { Metadata } from 'next';

type TenantSiteMetadataInput = {
  canonicalUrl: string;
  title: string;
  description: string;
  tenantName: string;
  ogImageUrl?: string | null;
  iconUrl?: string | null;
  noIndex?: boolean;
};

function hostMetadataBase(canonicalUrl: string): URL {
  const canonical = new URL(canonicalUrl);
  return new URL(`${canonical.protocol}//${canonical.host}`);
}

/**
 * Indexing metadata for a tenant marketing page.
 * Titles are absolute so the platform template (`| Clean Scheduler`) is not appended.
 * Open Graph images are the tenant's own artwork only — never the platform product shot.
 */
export function buildTenantSitePageMetadata({
  canonicalUrl,
  title,
  description,
  tenantName,
  ogImageUrl,
  iconUrl,
  noIndex = false,
}: TenantSiteMetadataInput): Metadata {
  const resolvedTitle = title.includes(tenantName) ? title : `${title} | ${tenantName}`;
  const image = ogImageUrl?.trim() || null;
  const icon = iconUrl?.trim() || null;
  const images = image ? [{ url: image, width: 1200, height: 630, alt: tenantName }] : [];

  return {
    title: { absolute: resolvedTitle },
    description,
    applicationName: tenantName,
    metadataBase: hostMetadataBase(canonicalUrl),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: resolvedTitle,
      description,
      type: 'website',
      siteName: tenantName,
      url: canonicalUrl,
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: resolvedTitle,
      description,
      images: image ? [image] : [],
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    ...(icon ? { icons: { icon } } : {}),
  };
}
