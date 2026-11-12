import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';

export interface QuoteCustomerOption {
  id: string;
  label: string;
}

export interface CustomerPropertyGroup {
  customerId: string;
  options: {
    id: string;
    label: string;
    /** Stored `tenant_customer_properties.label`, without the picker suffix. */
    storedLabel?: string;
    requiredCrewSize?: number;
    propertyKind?: CustomerPropertyKind;
    sqft?: number | null;
  }[];
}
