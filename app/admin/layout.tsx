import { PortalShell } from '@/components/portal/PortalShell';
import { PRODUCT_NAME } from '@/lib/legal/site';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { isPlatformAdminRole, isPlatformSalesRole } from '@/lib/auth/platformRoles';

export const dynamic = 'force-dynamic';

const FOUNDER_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Pipeline', href: '/pipeline', icon: 'quotes' },
  { label: 'Inquiries', href: '/inquiries', icon: 'inquiries' },
  { label: 'Outreach', href: '/outreach', icon: 'campaigns' },
  { label: 'SEO', href: '/seo', icon: 'seo' },
  { label: 'Tenants', href: '/tenants', icon: 'tenants' },
  { label: 'Fraud alerts', href: '/fraud', icon: 'audit' },
  { label: 'Signup blocks', href: '/fraud/signup-blocks', icon: 'audit' },
  { label: 'Accounting', href: '/accounting', icon: 'accounting' },
  { label: 'Customer Service', href: '/support', icon: 'messages' },
  { label: 'Audit log', href: '/audit', icon: 'audit' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

const SALES_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Pipeline', href: '/pipeline', icon: 'quotes' },
  { label: 'Outreach', href: '/outreach', icon: 'campaigns' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePortalAccess('admin', '/');
  const nonProdBanner = getNonProdPortalBanner();
  const role = auth.claims.appRole;
  const isSales = isPlatformSalesRole(role);

  const email = auth.user.email?.trim() ?? '';
  const emailLocal = email.split('@')[0] || (isSales ? 'Sales' : 'Admin');
  const identity: IdentityChipModel = {
    name: emailLocal,
    subtitle: isSales ? 'Sales' : 'Platform admin',
    initials: emailLocal.slice(0, 2).toUpperCase().padEnd(2, '·'),
  };

  return (
    <PortalShell
      brandLabel={PRODUCT_NAME}
      brandHref="/"
      navItems={isPlatformAdminRole(role) ? FOUNDER_NAV : SALES_NAV}
      identity={identity}
      tenantBadge={<span>{isSales ? 'Sales' : 'Founder Admin'}</span>}
      environmentBanner={nonProdBanner}
    >
      {children}
    </PortalShell>
  );
}
