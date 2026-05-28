/** First token of display name, or the whole string if single-word. */
export function firstNameFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return 'Member';
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

export function initialsFromDisplayName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
