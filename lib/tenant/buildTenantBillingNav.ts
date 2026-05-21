import type { NavItem } from '@/components/portal/types';
import type { Database } from '@/lib/supabase/database.types';
import { CUSTOMER_AR_NAV_LINKS } from '@/lib/tenant/customerBillingNav';

type ConnectStatus = Database['public']['Enums']['tenant_stripe_connect_status'];

/** Billing sidebar item with customer AR sub-links. */
export function buildTenantBillingNavItem(_connectStatus: ConnectStatus): NavItem {
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
