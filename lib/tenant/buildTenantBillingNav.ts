import type { NavItem } from '@/components/portal/types';
import type { Database } from '@/lib/supabase/database.types';

type ConnectStatus = Database['public']['Enums']['tenant_stripe_connect_status'];

/** Billing sidebar item with conditional Connect sub-links. */
export function buildTenantBillingNavItem(connectStatus: ConnectStatus): NavItem {
  const children: NavItem[] = [
    { label: 'Invoices', href: '/billing/invoices', icon: 'billing' },
    { label: 'Service Plans', href: '/billing/service-plans', icon: 'billing' },
    { label: 'Transactions', href: '/billing/transactions', icon: 'billing' },
    { label: 'Payment audits', href: '/billing/payment-audits', icon: 'billing' },
  ];

  if (connectStatus === 'complete') {
    children.push({
      label: 'Stripe Connect',
      href: '/billing/payment-setup',
      icon: 'billing',
    });
  } else {
    children.push({
      label: 'Setup',
      href: '/billing/payment-setup',
      icon: 'billing',
    });
  }

  return {
    label: 'Billing',
    href: '/billing',
    icon: 'billing',
    children,
  };
}
