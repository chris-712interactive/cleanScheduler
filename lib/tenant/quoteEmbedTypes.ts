import type { Tables } from '@/lib/supabase/database.types';

/** List projection: quote row + optional customer display name + optional property. */
export type QuoteListEmbedRow = Pick<
  Tables<'tenant_quotes'>,
  'id' | 'title' | 'status' | 'amount_cents' | 'currency' | 'created_at' | 'customer_id' | 'property_id'
> & {
  customers:
    | {
        customer_identities: Pick<Tables<'customer_identities'>, 'full_name'> | null;
      }
    | null;
  tenant_customer_properties:
    | Pick<Tables<'tenant_customer_properties'>, 'label' | 'address_line1' | 'city'>
    | null;
};

/** Quote detail with optional embedded service location. */
export type QuoteDetailEmbedRow = Tables<'tenant_quotes'> & {
  tenant_customer_properties:
    | Pick<
        Tables<'tenant_customer_properties'>,
        'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
      >
    | null;
};
