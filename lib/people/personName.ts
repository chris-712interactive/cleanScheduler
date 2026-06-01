/**
 * Shared first / last / full name helpers for people records (owners, customers, etc.).
 */

export function syncedFullNameFromParts(first: string, last: string): string | null {
  const f = first.trim();
  const l = last.trim();
  const parts = [f, l].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' ');
}

/** First name for "Hi {{name}}," — prefers first_name, falls back to first token of full_name. */
export function salutationFirstName(identity: {
  first_name?: string | null;
  full_name?: string | null;
}): string {
  const first = (identity.first_name ?? '').trim();
  if (first) return first;
  const legacy = (identity.full_name ?? '').trim();
  if (!legacy) return 'there';
  const token = legacy.split(/\s+/)[0];
  return token || 'there';
}
