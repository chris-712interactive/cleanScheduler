/** Customer accounts receivable links — shared by billing hub and sidebar. */
export const CUSTOMER_AR_NAV_LINKS = [
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/service-plans', label: 'Service plans' },
  { href: '/billing/transactions', label: 'Customer payments' },
  { href: '/billing/payment-audits', label: 'Payment audits' },
  { href: '/billing/bank-connection', label: 'Bank connection' },
  { href: '/billing/payment-setup', label: 'Payment setup' },
] as const;
