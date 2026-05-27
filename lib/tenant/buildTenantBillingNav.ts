import type { NavItem } from '@/components/portal/types';
import { CUSTOMER_AR_NAV_LINKS } from '@/lib/tenant/customerBillingNav';

/** Billing sidebar item with customer AR sub-links. */
export function buildTenantBillingNavItem(): NavItem {
  const children: NavItem[] = CUSTOMER_AR_NAV_LINKS.map(({ href, label }) => ({
    label,
    href,
    icon: 'billing' as const,
  }));

  return {
    label: 'Billing',
    href: '/billing',
    icon: 'billing',
    children,
  };
}
