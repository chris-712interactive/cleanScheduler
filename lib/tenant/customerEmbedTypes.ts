import type { Tables } from '@/lib/supabase/database.types';

/** Row shape for `customers` + embedded `customer_identities` (list projection). */
export type CustomerListEmbedRow = Pick<Tables<'customers'>, 'id' | 'status' | 'created_at'> & {
  customer_identities: Pick<Tables<'customer_identities'>, 'email' | 'full_name' | 'phone'> | null;
};

/** Row shape for `customers` + embedded `customer_identities` (detail projection). */
export type CustomerDetailEmbedRow = Pick<Tables<'customers'>, 'id' | 'status' | 'created_at'> & {
  customer_identities: Pick<
    Tables<'customer_identities'>,
    'id' | 'email' | 'full_name' | 'phone'
  > | null;
  tenant_customer_profiles: Pick<
    Tables<'tenant_customer_profiles'>,
    | 'company_name'
    | 'service_address_line1'
    | 'service_address_line2'
    | 'service_city'
    | 'service_state'
    | 'service_postal_code'
    | 'preferred_contact_method'
    | 'internal_notes'
  > | null;
};
