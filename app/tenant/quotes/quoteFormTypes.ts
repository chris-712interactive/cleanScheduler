export interface QuoteCustomerOption {
  id: string;
  label: string;
}

export interface CustomerPropertyGroup {
  customerId: string;
  options: { id: string; label: string }[];
}
