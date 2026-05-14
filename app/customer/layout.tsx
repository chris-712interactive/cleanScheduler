import { PortalShell } from '@/components/portal/PortalShell';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerShellIdentity } from '@/lib/customer/customerShell';
import { headers } from 'next/headers';
import styles from './customer-layout.module.scss';

export const dynamic = 'force-dynamic';

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home', exact: true },
  { label: 'Visits', href: '/visits', icon: 'visits' },
  { label: 'Invoices', href: '/invoices', icon: 'invoices' },
  { label: 'Subscriptions', href: '/subscriptions', icon: 'subscriptions' },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Payment methods', href: '/payment-methods', icon: 'paymentMethods' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

// Customer portal opts in to a mobile bottom nav for the most common
// destinations (Home / Visits / Invoices). The full nav stays accessible via
// the drawer.
const BOTTOM_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home', exact: true },
  { label: 'Visits', href: '/visits', icon: 'visits' },
  { label: 'Invoices', href: '/invoices', icon: 'invoices' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

const IDENTITY: IdentityChipModel = {
  name: 'Customer',
  subtitle: 'Account',
  initials: 'CU',
};

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const internal = h.get('x-internal-pathname') ?? '';
  if (internal.startsWith('/customer/complete-invite')) {
    return <div className={styles.publicInvite}>{children}</div>;
  }

  const auth = await requirePortalAccess('customer', '/');
  const nonProdBanner = getNonProdPortalBanner();
  const identity = await getCustomerShellIdentity(auth.user.id);

  return (
    <PortalShell
      brandLabel="cleanScheduler"
      brandHref="/"
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
      identity={identity ?? IDENTITY}
      tenantBadge={<span>my.cleanscheduler.com</span>}
      environmentBanner={nonProdBanner}
    >
      {children}
    </PortalShell>
  );
}
