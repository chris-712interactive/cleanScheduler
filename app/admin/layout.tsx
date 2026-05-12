import { PortalShell } from '@/components/portal/PortalShell';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';
import { requirePortalAccess } from '@/lib/auth/portalAccess';

export const dynamic = 'force-dynamic';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Inquiries', href: '/inquiries', icon: 'inquiries' },
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePortalAccess('admin', '/');
  const nonProdBanner = getNonProdPortalBanner();

  return (
    <PortalShell
      brandLabel="cleanScheduler"
      brandHref="/"
      navItems={NAV_ITEMS}
      identity={IDENTITY}
      tenantBadge={<span>Founder Admin</span>}
      environmentBanner={nonProdBanner}
    >
      {children}
    </PortalShell>
  );
}
