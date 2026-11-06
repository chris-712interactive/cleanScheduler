/** True for /book and /request on any host, including absolute URLs. */
export function isPublicBookingHref(href: string | null | undefined): boolean {
  const raw = href?.trim() ?? '';
  if (!raw) return false;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      return false;
    }
  }
  path = path.split('?')[0]?.split('#')[0] ?? '';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path === '/book' || path === '/request';
}
