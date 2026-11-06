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
    requiredCrewSize?: number;
    propertyKind?: CustomerPropertyKind;
    sqft?: number | null;
  }[];
}
