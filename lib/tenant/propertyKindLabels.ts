import type { Enums } from '@/lib/supabase/database.types';

export type CustomerPropertyKind = Enums<'customer_property_kind'>;

export const PROPERTY_KIND_LABEL: Record<CustomerPropertyKind, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  short_term_rental: 'Short-term rental',
  other: 'Other',
};

export const PROPERTY_KIND_OPTIONS: { value: CustomerPropertyKind; label: string }[] = [
  { value: 'residential', label: PROPERTY_KIND_LABEL.residential },
  { value: 'commercial', label: PROPERTY_KIND_LABEL.commercial },
  { value: 'short_term_rental', label: PROPERTY_KIND_LABEL.short_term_rental },
  { value: 'other', label: PROPERTY_KIND_LABEL.other },
];
