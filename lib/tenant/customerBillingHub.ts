/** User-facing billing hub cards — distinct from sidebar nav labels. */
export type CustomerBillingHubItem = {
  href: string;
  label: string;
  description: string;
};

export const CUSTOMER_BILLING_HUB_PRIMARY: CustomerBillingHubItem[] = [
  {
    href: '/billing/invoices',
    label: 'Invoices',
    description: 'Create, send, and track what customers owe you.',
  },
  {
    href: '/billing/payment-setup',
    label: 'Accept card payments',
    description: 'Connect Stripe so customers can pay invoices online.',
  },
  {
    href: '/billing/transactions',
    label: 'Payments received',
    description: 'Review card, cash, check, and other customer payments.',
  },
];

export const CUSTOMER_BILLING_HUB_SECONDARY: CustomerBillingHubItem[] = [
  {
    href: '/billing/service-plans',
    label: 'Recurring customer plans',
    description: 'Charge customers on a schedule.',
  },
  {
    href: '/billing/bank-connection',
    label: 'Deposit matching',
    description: 'Match Zelle, ACH, and wire deposits from your bank to open invoices.',
  },
  {
    href: '/billing/payment-audits',
    label: 'Offline payment review',
    description: 'Confirm cash, check, and manual entries.',
  },
];
