import { PortalShell } from '@/components/portal/PortalShell';
import { getPortalContext } from '@/lib/portal';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Employees', href: '/employees', icon: 'work' },
  { label: 'Billing', href: '/billing', icon: 'billing' },
  { label: 'Campaigns', href: '/campaigns', icon: 'campaigns' },
  { label: 'Reports', href: '/reports', icon: 'reports' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

const IDENTITY: IdentityChipModel = {
  name: 'Tenant Admin',
  subtitle: 'Owner',
  initials: 'TA',
};

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = await getPortalContext();
  const slug = tenantSlug ?? 'preview';

  return (
    <PortalShell
      brandLabel={slug}
      brandHref="/"
      navItems={NAV_ITEMS}
      identity={IDENTITY}
      tenantBadge={<span>{slug}.cleanscheduler.com</span>}
    >
      {children}
    </PortalShell>
  );
}
