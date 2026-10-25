/** Browser path for a CMS page on the host the visitor is using. */
export function publicPathForSitePage(
  slug: string,
  unifiedDomain: boolean,
  homepageSlug = 'home',
): string {
  if (slug === 'home' || slug === homepageSlug) {
    return unifiedDomain ? '/' : '/site';
  }
  return unifiedDomain ? `/${slug}` : `/site/${slug}`;
}

/**
 * Rewrite CMS hrefs (`/contact`, `/site/services`) onto the current host.
 * Absolute, mailto, tel, and hash links are left alone.
 */
export function resolveTenantSiteHref(
  href: string,
  unifiedDomain: boolean,
  homepageSlug = 'home',
): string {
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed;

  let slug = trimmed.replace(/^\//, '').replace(/\/$/, '');
  if (slug === 'site') slug = homepageSlug;
  if (slug.startsWith('site/')) slug = slug.slice('site/'.length);
  if (!slug) slug = homepageSlug;
  return publicPathForSitePage(slug, unifiedDomain, homepageSlug);
}

/**
 * Canonical absolute URL.
 * `origin` is the public site root: `https://www.acme.com` or `https://acme.example.com/site`.
 */
export function buildTenantSitePublicUrl(
  origin: string,
  slug: string,
  homepageSlug: string,
): string {
  const base = origin.replace(/\/$/, '');
  if (!slug || slug === homepageSlug) return base;
  return `${base}/${slug}`;
}

export function requestHostMatchesSiteOrigin(requestHost: string, origin: string): boolean {
  const host = requestHost.split(',')[0]?.trim().toLowerCase();
  if (!host) return false;
  try {
    return host === new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
}

/** Sitemap location on the host that served the request (`/sitemap.xml`, never under `/site`). */
export function absoluteSitemapUrl(requestHost: string): string {
  const host = requestHost.split(',')[0]?.trim().toLowerCase() ?? '';
  const hostname = host.split(':')[0] ?? host;
  const proto =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'lvh.me' ||
    hostname.endsWith('.lvh.me') ||
    hostname === '127.0.0.1'
      ? 'http'
      : 'https';
  return `${proto}://${host}/sitemap.xml`;
}
