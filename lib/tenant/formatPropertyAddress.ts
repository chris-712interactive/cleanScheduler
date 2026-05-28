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
