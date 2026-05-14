import type { Tables } from '@/lib/supabase/database.types';

/** List projection: quote row + optional customer display name + optional property. */
export type QuoteListEmbedRow = Pick<
  Tables<'tenant_quotes'>,
  | 'id'
  | 'title'
  | 'status'
  | 'amount_cents'
  | 'currency'
  | 'created_at'
  | 'customer_id'
  | 'property_id'
  | 'quote_group_id'
  | 'version_number'
  | 'is_locked'
  | 'superseded_by_quote_id'
> & {
  customers: {
    customer_identities: Pick<
      Tables<'customer_identities'>,
      'first_name' | 'last_name' | 'full_name'
    > | null;
  } | null;
  tenant_customer_properties: Pick<
    Tables<'tenant_customer_properties'>,
    'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
  > | null;
};

/** Quote detail with optional embedded service location. */
export type QuoteDetailEmbedRow = Tables<'tenant_quotes'> & {
  tenant_customer_properties: Pick<
    Tables<'tenant_customer_properties'>,
    'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
  > | null;
  tenant_quote_line_items:
    | Pick<
        Tables<'tenant_quote_line_items'>,
        | 'id'
        | 'sort_order'
        | 'service_label'
        | 'frequency'
        | 'frequency_detail'
        | 'amount_cents'
        | 'line_discount_kind'
        | 'line_discount_value'
      >[]
    | null;
};
