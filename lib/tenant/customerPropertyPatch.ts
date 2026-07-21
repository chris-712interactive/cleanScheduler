import type { Tables } from '@/lib/supabase/database.types';

/** Service location row used on customer detail and property action DTOs. */
export type CustomerPropertyVM = Pick<
  Tables<'tenant_customer_properties'>,
  | 'id'
  | 'label'
  | 'property_kind'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'site_notes'
  | 'is_primary'
  | 'service_zone_id'
>;

export type CustomerPropertiesPatch =
  | { op: 'add'; property: CustomerPropertyVM }
  | { op: 'update'; property: CustomerPropertyVM }
  | { op: 'delete'; propertyId: string; primaryPropertyId?: string | null }
  | { op: 'setPrimary'; primaryPropertyId: string };

export function applyCustomerPropertiesPatch(
  properties: CustomerPropertyVM[],
  patch: CustomerPropertiesPatch,
): CustomerPropertyVM[] {
  switch (patch.op) {
    case 'add':
      if (patch.property.is_primary) {
        return [...properties.map((p) => ({ ...p, is_primary: false })), patch.property];
      }
      return [...properties, patch.property];
    case 'update':
      return properties.map((p) => (p.id === patch.property.id ? patch.property : p));
    case 'delete': {
      const remaining = properties.filter((p) => p.id !== patch.propertyId);
      if (!patch.primaryPropertyId) return remaining;
      return remaining.map((p) => ({
        ...p,
        is_primary: p.id === patch.primaryPropertyId,
      }));
    }
    case 'setPrimary':
      return properties.map((p) => ({
        ...p,
        is_primary: p.id === patch.primaryPropertyId,
      }));
  }
}

export const CUSTOMER_PROPERTY_SELECT =
  'id, label, property_kind, address_line1, address_line2, city, state, postal_code, site_notes, is_primary, service_zone_id' as const;
