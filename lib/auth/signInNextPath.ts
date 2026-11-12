/** Drop the support handoff secret before it is copied into `/sign-in?next=`. */
export function pathnameWithSearchWithoutHandoff(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('handoff');
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

/**
 * Signed-in browsers keep `?handoff=` in the address bar on every path except
 * the redeem route. Returns the replacement search (`''` or `?a=b`), or null
 * when the request should stay as it is. The redeem route still receives the
 * token so it can sign the staff user in and then drop the query itself.
 */
export function searchWithoutHandoffForSignedIn(
  search: string,
  options: { signedIn: boolean; handoffRoute: boolean },
): string | null {
  if (!options.signedIn || options.handoffRoute) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!params.has('handoff')) return null;
  params.delete('handoff');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
