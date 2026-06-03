import { cache } from 'react';
import type { NavItem } from '@/components/portal/types';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { getCachedPendingCustomerQuoteCount } from '@/lib/portal/cachedNavChrome';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { customerReferralsNavEnabled } from '@/lib/referrals/loadCustomerReferralPortal';

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/visits', icon: 'visits' },
  { label: 'Billing', href: '/invoices', icon: 'invoices' },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

const REFERRALS_NAV_ITEM: NavItem = {
  label: 'Referrals',
  href: '/referrals',
  icon: 'referrals',
};

export const loadCustomerNavItemsForShell = cache(async (userId: string): Promise<NavItem[]> => {
  const ctx = await getCustomerPortalContext(userId);
  const pendingQuoteCount = ctx ? await getCachedPendingCustomerQuoteCount(ctx.customerIds) : 0;

  let items = [...CUSTOMER_NAV_ITEMS];

  if (ctx?.links.length) {
    const admin = createAdminClient();
    const portal = await getPortalContext();
    const scopedSlug = portal.tenantSlug?.toLowerCase();
    const link =
      (scopedSlug ? ctx.links.find((l) => l.tenantSlug === scopedSlug) : null) ??
      ctx.links.find((l) => l.isPrimary) ??
      ctx.links[0];

    if (link && (await customerReferralsNavEnabled(admin, link))) {
      items = [...items.slice(0, 4), REFERRALS_NAV_ITEM, ...items.slice(4)];
    }
  }

  return items.map((item) =>
    item.href === '/quotes' && pendingQuoteCount > 0 ? { ...item, badge: pendingQuoteCount } : item,
  );
});
