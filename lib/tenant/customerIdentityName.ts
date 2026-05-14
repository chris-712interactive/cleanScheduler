/**
 * Helpers for customer_identities first/last/full_name.
 * Writes should set first_name + last_name and synced full_name (see server actions).
 */

export function syncedFullNameFromParts(first: string, last: string): string | null {
  const f = first.trim();
  const l = last.trim();
  const parts = [f, l].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' ');
}

export function formatCustomerDisplayName(identity: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): string {
  const f = (identity.first_name ?? '').trim();
  const l = (identity.last_name ?? '').trim();
  if (f || l) return [f, l].filter(Boolean).join(' ');
  const legacy = (identity.full_name ?? '').trim();
  return legacy || 'Unnamed';
}

export function customerHasAnyNameParts(identity: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): boolean {
  return (
    !!(identity.first_name ?? '').trim() ||
    !!(identity.last_name ?? '').trim() ||
    !!(identity.full_name ?? '').trim()
  );
}

/** Value for Resend `customerName` on portal invite — first name only, with legacy fallback. */
export function inviteTemplateCustomerFirstName(identity: {
  first_name?: string | null;
  full_name?: string | null;
}): string {
  const f = (identity.first_name ?? '').trim();
  if (f) return f;
  const legacy = (identity.full_name ?? '').trim();
  if (!legacy) return 'there';
  const token = legacy.split(/\s+/)[0];
  return token || 'there';
}
