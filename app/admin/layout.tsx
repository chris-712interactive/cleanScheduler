import { PortalShell } from '@/components/portal/PortalShell';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Tenants', href: '/tenants', icon: 'tenants' },
  { label: 'Customers', href: '/customers', icon: 'customersGlobal' },
  { label: 'Billing', href: '/billing', icon: 'billing' },
  { label: 'Reports', href: '/reports', icon: 'reports' },
  { label: 'Activity', href: '/activity', icon: 'activity' },
  { label: 'Audit log', href: '/audit', icon: 'audit' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

const IDENTITY: IdentityChipModel = {
  name: 'Founder',
  subtitle: 'Super Admin',
  initials: 'FA',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      brandLabel="cleanScheduler"
      brandHref="/"
      navItems={NAV_ITEMS}
      identity={IDENTITY}
      tenantBadge={<span>Founder Admin</span>}
    >
      {children}
    </PortalShell>
  );
}
