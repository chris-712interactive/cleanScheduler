import type { Tables } from '@/lib/supabase/database.types';

/** Any subset of address columns (e.g. list queries that only select a few fields). */
type AddressLineInput = Partial<
  Pick<
    Tables<'tenant_customer_properties'>,
    'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
  >
>;

/** Single-line mailing-style address for lists and summaries. */
export function formatPropertyAddressLine(row: AddressLineInput | null | undefined): string {
  if (!row) return '';
  return [row.address_line1, row.address_line2, row.city, row.state, row.postal_code]
    .filter(Boolean)
    .join(', ');
}

const TRAILING_POSTAL_CODE = /^\d{5}(?:-\d{4})?$/;
const TRAILING_STATE = /^[A-Za-z]{2}$/;

/**
 * Street and city for schedule chips. Drops a trailing state and ZIP so the
 * line fits a one-hour calendar card. Full mailing addresses stay on the visit.
 */
export function compactCalendarAddress(siteLine: string): string {
  const parts = siteLine
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';

  const compact = [...parts];
  const last = compact[compact.length - 1] ?? '';
  if (TRAILING_POSTAL_CODE.test(last)) compact.pop();

  const maybeState = compact[compact.length - 1] ?? '';
  if (compact.length > 1 && TRAILING_STATE.test(maybeState)) compact.pop();

  return compact.length > 0 ? compact.join(', ') : parts.join(', ');
}
