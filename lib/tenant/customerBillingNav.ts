/** Customer accounts receivable links — shared by billing hub and sidebar. */
export const CUSTOMER_AR_NAV_LINKS = [
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/service-plans', label: 'Subscription plans' },
  { href: '/billing/transactions', label: 'Customer payments' },
  { href: '/billing/payment-audits', label: 'Payment audits' },
  { href: '/billing/bank-connection', label: 'Deposit matching' },
  { href: '/billing/payment-setup', label: 'Card payments' },
] as const;
