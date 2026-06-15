export function publicPathForSitePage(slug: string, unifiedDomain: boolean): string {
  if (slug === 'home') {
    return unifiedDomain ? '/' : '/site';
  }
  return unifiedDomain ? `/${slug}` : `/site/${slug}`;
}
