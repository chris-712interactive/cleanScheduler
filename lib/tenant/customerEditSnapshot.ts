export type CustomerEditSnapshot = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  companyName: string;
  preferredContactMethod: string;
  preferredPaymentMethod: string;
  internalNotes: string;
  marketingEmailOptIn: boolean;
};

export function buildCustomerEditSnapshot(input: {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  companyName: string;
  preferredContactMethod: string;
  preferredPaymentMethod: string;
  internalNotes: string;
  marketingEmailOptIn: boolean;
}): CustomerEditSnapshot {
  return {
    customerId: input.customerId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    status: input.status === 'inactive' ? 'inactive' : 'active',
    companyName: input.companyName,
    preferredContactMethod: input.preferredContactMethod,
    preferredPaymentMethod: input.preferredPaymentMethod,
    internalNotes: input.internalNotes,
    marketingEmailOptIn: input.marketingEmailOptIn,
  };
}
