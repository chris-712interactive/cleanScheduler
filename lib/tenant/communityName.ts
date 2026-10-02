const MAX_COMMUNITY_NAME_LENGTH = 120;

/** Optional neighborhood or gated-community name. Empty input stores as null. */
export function normalizeCommunityName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_COMMUNITY_NAME_LENGTH);
}
