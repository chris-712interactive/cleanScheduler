import { PortalShell } from '@/components/portal/PortalShell';
import { MasqueradeExitBanner } from '@/components/portal/MasqueradeExitBanner';
import { ConnectStatusBanner } from '@/components/billing/ConnectStatusBanner';
import { getPortalContext } from '@/lib/portal';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

/**
 * Sidebar order matches product build priority for net-new tenant work (after
 * Dashboard): quotes → customers → schedule (`lib/tenant/portalBuildOrder.ts`).
 */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
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
  const membership = await requireTenantPortalAccess(tenantSlug, '/');
  const slug = membership.tenantSlug;

  const identity: IdentityChipModel = {
    ...IDENTITY,
    subtitle: membership.role,
  };

  const nonProdBanner = getNonProdPortalBanner();
  const auth = await getAuthContext();
  const masquerading =
    Boolean(auth?.claims.masqueradeTargetTenantId) &&
    (auth?.claims.appRole === 'super_admin' || auth?.claims.appRole === 'admin');

  const supabase = createTenantPortalDbClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('stripe_connect_status')
    .eq('id', membership.tenantId)
    .maybeSingle();

  const connectStatus = tenantRow?.stripe_connect_status ?? 'not_started';

  const sessionNotices: ReactNode[] = [];
  if (masquerading) sessionNotices.push(<MasqueradeExitBanner key="masq" />);
  if (connectStatus !== 'complete') {
    sessionNotices.push(<ConnectStatusBanner key="connect" status={connectStatus} />);
  }
  const sessionNotice = sessionNotices.length > 0 ? <>{sessionNotices}</> : null;

  return (
    <PortalShell
      brandLabel={slug}
      brandHref="/"
      navItems={NAV_ITEMS}
      identity={identity}
      tenantBadge={<span>{slug}.cleanscheduler.com</span>}
      environmentBanner={nonProdBanner}
      sessionNotice={sessionNotice}
    >
      {children}
    </PortalShell>
  );
}
