import { PortalShell } from '@/components/portal/PortalShell';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home', exact: true },
  { label: 'Visits', href: '/visits', icon: 'visits' },
  { label: 'Invoices', href: '/invoices', icon: 'invoices' },
  { label: 'Payment methods', href: '/payment-methods', icon: 'paymentMethods' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
];

// Customer portal opts in to a mobile bottom nav for the most common
// destinations (Home / Visits / Invoices). The full nav stays accessible via
// the drawer.
const BOTTOM_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home', exact: true },
  { label: 'Visits', href: '/visits', icon: 'visits' },
  { label: 'Invoices', href: '/invoices', icon: 'invoices' },
];

const IDENTITY: IdentityChipModel = {
  name: 'Customer',
  subtitle: 'Account',
  initials: 'CU',
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      brandLabel="cleanScheduler"
      brandHref="/"
      navItems={NAV_ITEMS}
      bottomNavItems={BOTTOM_NAV}
      identity={IDENTITY}
      tenantBadge={<span>my.cleanscheduler.com</span>}
    >
      {children}
    </PortalShell>
  );
}
