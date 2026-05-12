import type { Tables } from '@/lib/supabase/database.types';

/** Row shape for `customers` + embedded `customer_identities` (list projection). */
export type CustomerListEmbedRow = Pick<Tables<'customers'>, 'id' | 'status' | 'created_at'> & {
  customer_identities: Pick<Tables<'customer_identities'>, 'email' | 'full_name' | 'phone'> | null;
};

type ProfilePick = Pick<
  Tables<'tenant_customer_profiles'>,
  'company_name' | 'preferred_contact_method' | 'internal_notes'
>;

type PropertyPick = Pick<
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
>;

/** Row shape for `customers` + profile + service locations (detail projection). */
export type CustomerDetailEmbedRow = Pick<Tables<'customers'>, 'id' | 'status' | 'created_at'> & {
  customer_identities: Pick<
    Tables<'customer_identities'>,
    'id' | 'email' | 'full_name' | 'phone' | 'auth_user_id'
  > | null;
  tenant_customer_profiles: ProfilePick | null;
  tenant_customer_properties: PropertyPick[] | null;
};
