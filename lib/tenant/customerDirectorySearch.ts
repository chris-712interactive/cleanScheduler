/** Escape `%` and `_` so user input cannot broaden an `ilike` pattern. */
export function escapeIlikeMetacharacters(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Build name/email/phone `ilike` filters for Supabase `.or()`. */
export function customerIdentitySearchOrClause(trimmedQuery: string): string {
  const inner = escapeIlikeMetacharacters(trimmedQuery);
  const pat = `%${inner}%`;
  const parts = [
    `first_name.ilike.${pat}`,
    `last_name.ilike.${pat}`,
    `full_name.ilike.${pat}`,
    `email.ilike.${pat}`,
    `phone.ilike.${pat}`,
  ];

  const digits = trimmedQuery.replace(/\D/g, '');
  if (digits.length >= 3 && digits !== trimmedQuery) {
    const digitPat = `%${escapeIlikeMetacharacters(digits)}%`;
    parts.push(`phone.ilike.${digitPat}`);
  }

  return parts.join(',');
}

/** Build address `ilike` filters for Supabase `.or()` on tenant_customer_properties. */
export function customerPropertySearchOrClause(trimmedQuery: string): string {
  const inner = escapeIlikeMetacharacters(trimmedQuery);
  const pat = `%${inner}%`;
  return [
    `address_line1.ilike.${pat}`,
    `address_line2.ilike.${pat}`,
    `city.ilike.${pat}`,
    `state.ilike.${pat}`,
    `postal_code.ilike.${pat}`,
  ].join(',');
}

/** Match table status labels/partial input ("Active", "Inactive", "act", "inact"). */
export function customerDirectoryStatusFromQuery(
  trimmedQuery: string,
): 'active' | 'inactive' | null {
  const normalized = trimmedQuery.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.startsWith('inact') ||
    normalized === 'inactive' ||
    'inactive'.startsWith(normalized)
  ) {
    return 'inactive';
  }

  if (normalized.startsWith('act') || normalized === 'active' || 'active'.startsWith(normalized)) {
    return 'active';
  }

  return null;
}

export function buildCustomerDirectorySearchOrFilter(params: {
  identityIds: string[];
  customerIds: string[];
}): string | null {
  const parts: string[] = [];

  if (params.identityIds.length > 0) {
    parts.push(`customer_identity_id.in.(${params.identityIds.join(',')})`);
  }

  if (params.customerIds.length > 0) {
    parts.push(`id.in.(${params.customerIds.join(',')})`);
  }

  return parts.length > 0 ? parts.join(',') : null;
}

export type CustomerDirectoryStatusParam = 'all' | 'active' | 'inactive';

export function parseCustomerDirectoryStatus(
  raw: string | string[] | undefined,
): CustomerDirectoryStatusParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'active' || v === 'inactive') return v;
  return 'all';
}

export function parseCustomerDirectoryQuery(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return '';
  return v.trim();
}
