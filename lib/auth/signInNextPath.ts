/** Drop the support handoff secret before it is copied into `/sign-in?next=`. */
export function pathnameWithSearchWithoutHandoff(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('handoff');
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
