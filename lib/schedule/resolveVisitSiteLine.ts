import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';

type PropertyAddressPick = Pick<
  Tables<'tenant_customer_properties'>,
  'is_primary' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
>;

/** Street address for schedule cards (visit property, else customer primary site). */
export function resolveVisitSiteLine(
  visitProperty: Omit<PropertyAddressPick, 'is_primary'> | null | undefined,
  customerProperties: PropertyAddressPick[] | null | undefined,
): string {
  const fromVisit = formatPropertyAddressLine(visitProperty);
  if (fromVisit) return fromVisit;

  const props = customerProperties ?? [];
  if (props.length === 0) return '';

  const primary = props.find((p) => p.is_primary) ?? props[0];
  return formatPropertyAddressLine(primary);
}
