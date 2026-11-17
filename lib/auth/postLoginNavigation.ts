/**
 * Password sign-in runs on the marketing sign-in route. The proxy rewrote
 * `/sign-in` to that route, so a client navigation to `/` can reuse the
 * marketing homepage until a full reload. A document load lets the proxy
 * rewrite `/` to the signed-in portal. Deeper paths such as `/tenants` already
 * fetch a different route and do not need that reload.
 */
export function postLoginUsesDocumentNavigation(url: string): boolean {
  try {
    return new URL(url).pathname === '/';
  } catch {
    return false;
  }
}
