import { cache } from 'react';
import type { NavItem } from '@/components/portal/types';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { getCachedPendingCustomerQuoteCount } from '@/lib/portal/cachedNavChrome';

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/visits', icon: 'visits' },
  { label: 'Billing', href: '/invoices', icon: 'invoices' },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

export const loadCustomerNavItemsForShell = cache(async (userId: string): Promise<NavItem[]> => {
  const ctx = await getCustomerPortalContext(userId);
  const pendingQuoteCount = ctx ? await getCachedPendingCustomerQuoteCount(ctx.customerIds) : 0;

  return CUSTOMER_NAV_ITEMS.map((item) =>
    item.href === '/quotes' && pendingQuoteCount > 0 ? { ...item, badge: pendingQuoteCount } : item,
  );
});
