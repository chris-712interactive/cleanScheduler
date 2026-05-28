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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePortalAccess('admin', '/');
  const nonProdBanner = getNonProdPortalBanner();

  const email = auth.user.email?.trim() ?? '';
  const emailLocal = email.split('@')[0] || 'Admin';
  const identity: IdentityChipModel = {
    name: emailLocal,
    subtitle: 'Platform admin',
    initials: emailLocal.slice(0, 2).toUpperCase().padEnd(2, '·'),
  };

  return (
    <PortalShell
      brandLabel="cleanScheduler"
      brandHref="/"
      navItems={NAV_ITEMS}
      identity={identity}
      tenantBadge={<span>Founder Admin</span>}
      environmentBanner={nonProdBanner}
    >
      {children}
    </PortalShell>
  );
}
