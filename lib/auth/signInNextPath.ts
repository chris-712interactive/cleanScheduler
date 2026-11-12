const HANDOFF_PARAM = /^handoff$/i;

function deleteHandoffParams(params: URLSearchParams): boolean {
  const keys = [...params.keys()].filter((key) => HANDOFF_PARAM.test(key));
  for (const key of keys) params.delete(key);
  return keys.length > 0;
}

function decodeLayers(value: string): string {
  let current = value;
  for (let pass = 0; pass < 10; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      break;
    }
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Remove `handoff` from a path or URL stored in `next`, including nested `next` values. */
function stripHandoffFromUrlLike(value: string): { value: string; changed: boolean } {
  const decoded = decodeLayers(value);
  const queryAt = decoded.indexOf('?');
  if (queryAt < 0) return { value, changed: false };
  const params = new URLSearchParams(decoded.slice(queryAt + 1));
  let changed = deleteHandoffParams(params);
  const nested = params.getAll('next');
  if (nested.length > 0) {
    params.delete('next');
    for (const item of nested) {
      const stripped = stripHandoffFromUrlLike(item);
      if (stripped.changed) changed = true;
      params.append('next', stripped.value);
    }
  }
  if (!changed) return { value, changed: false };
  const rest = params.toString();
  const path = decoded.slice(0, queryAt);
  return { value: rest ? `${path}?${rest}` : path, changed: true };
}

function withoutHandoffParams(search: string): { search: string; changed: boolean } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let changed = deleteHandoffParams(params);
  const nested = params.getAll('next');
  if (nested.some((item) => stripHandoffFromUrlLike(item).changed)) {
    changed = true;
    params.delete('next');
    for (const item of nested) params.append('next', stripHandoffFromUrlLike(item).value);
  }
  const rest = params.toString();
  return { search: rest ? `?${rest}` : '', changed };
}

/** Drop the support handoff secret before it is copied into `/sign-in?next=`. */
export function pathnameWithSearchWithoutHandoff(pathname: string, search: string): string {
  const cleaned = withoutHandoffParams(search);
  return cleaned.search ? `${pathname}${cleaned.search}` : pathname;
}

/**
 * Drop `handoff` / `Handoff` / `HANDOFF` from a request on every host and path
 * except the redeem route. Signed-in and signed-out browsers both lose the
 * query, including when it is nested inside `next`. Returns the replacement
 * search (`''` or `?a=b`), or null when the request should stay as it is.
 */
export function searchWithoutHandoffParam(
  search: string,
  options: { handoffRoute: boolean },
): string | null {
  if (options.handoffRoute) return null;
  const cleaned = withoutHandoffParams(search);
  if (!cleaned.changed) return null;
  return cleaned.search;
}
