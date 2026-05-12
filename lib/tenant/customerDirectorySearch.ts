/** Escape `%` and `_` so user input cannot broaden an `ilike` pattern. */
export function escapeIlikeMetacharacters(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Build `full_name.ilike.%…%,email.ilike.%…%,phone.ilike.%…%` for Supabase `.or()`. */
export function customerIdentitySearchOrClause(trimmedQuery: string): string {
  const inner = escapeIlikeMetacharacters(trimmedQuery);
  const pat = `%${inner}%`;
  return `full_name.ilike.${pat},email.ilike.${pat},phone.ilike.${pat}`;
}

export type CustomerDirectoryStatusParam = 'all' | 'active' | 'inactive';

export function parseCustomerDirectoryStatus(raw: string | string[] | undefined): CustomerDirectoryStatusParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'active' || v === 'inactive') return v;
  return 'all';
}

export function parseCustomerDirectoryQuery(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return '';
  return v.trim();
}
