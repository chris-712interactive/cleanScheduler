const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const RESERVED_SUBDOMAINS = new Set(['admin', 'my', 'www', 'api', 'app', 'auth', 'dev', 'preview']);

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function validateSlug(slug: string): string | null {
  if (!slug) return 'Workspace slug is required.';
  if (!SLUG_REGEX.test(slug)) {
    return 'Workspace slug must be 3-63 chars, lowercase letters, numbers, or hyphens.';
  }
  if (RESERVED_SUBDOMAINS.has(slug)) {
    return 'That workspace slug is reserved. Choose another.';
  }
  return null;
}
