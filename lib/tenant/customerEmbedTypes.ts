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
};
