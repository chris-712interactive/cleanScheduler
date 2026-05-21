import { PortalShell } from '@/components/portal/PortalShell';
import { GlobalSearch } from '@/components/portal/GlobalSearch';
import { MasqueradeExitBanner } from '@/components/portal/MasqueradeExitBanner';
import { ConnectStatusBanner } from '@/components/billing/ConnectStatusBanner';
import { TrialSubscriptionBanner } from '@/components/billing/TrialSubscriptionBanner';
import { WorkspacePausedBanner } from '@/components/billing/WorkspacePausedBanner';
import {
  needsSubscriptionPurchase,
  resolveTenantSubscriptionAccess,
  shouldShowTrialPurchaseBanner,
  trialDaysRemaining,
} from '@/lib/billing/tenantSubscriptionAccess';
import { getPortalContext } from '@/lib/portal';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem, IdentityChipModel } from '@/components/portal/types';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createTenantPortalDbClient, createAdminClient } from '@/lib/supabase/server';
import { countPendingRescheduleRequests } from '@/lib/tenant/pendingRescheduleRequestCount';
import { buildTenantBillingNavItem } from '@/lib/tenant/buildTenantBillingNav';
import { buildTenantSettingsNavItem } from '@/lib/tenant/buildTenantSettingsNav';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

/**
 * Sidebar order matches product build priority for net-new tenant work (after
 * Dashboard): quotes → customers → schedule (`lib/tenant/portalBuildOrder.ts`).
 */
const NAV_ITEMS_BASE: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Reschedule requests', href: '/schedule/reschedule-requests', icon: 'rescheduleRequests' },
  { label: 'Employees', href: '/employees', icon: 'work' },
  { label: 'Campaigns', href: '/campaigns', icon: 'campaigns' },
  { label: 'Reports', href: '/reports', icon: 'reports' },
];

const TENANT_BOTTOM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Billing', href: '/billing', icon: 'billing' },
];

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/');
  const slug = membership.tenantSlug;

  const nonProdBanner = getNonProdPortalBanner();
  const auth = await getAuthContext();
  const masquerading =
    Boolean(auth?.claims.masqueradeTargetTenantId) &&
    (auth?.claims.appRole === 'super_admin' || auth?.claims.appRole === 'admin');

  const supabase = createTenantPortalDbClient();
  const [{ data: tenantRow }, { data: billingRow }] = await Promise.all([
    supabase
      .from('tenants')
      .select('stripe_connect_status, is_active')
      .eq('id', membership.tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_billing_accounts')
      .select('status, trial_ends_at, stripe_subscription_id')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  const subscriptionAccess = resolveTenantSubscriptionAccess({
    billingStatus: billingRow?.status,
    trialEndsAt: billingRow?.trial_ends_at,
    tenantIsActive: tenantRow?.is_active !== false,
    stripeSubscriptionId: billingRow?.stripe_subscription_id,
  });
  const trialDaysLeft = trialDaysRemaining(billingRow?.trial_ends_at ?? null);

  let identityName = 'Team member';
  let identityInitials = 'TM';
  let identityAvatar: string | undefined;
  if (auth?.user.id) {
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    const dn = prof?.display_name?.trim();
    const emailLocal = auth.user.email?.split('@')[0];
    identityName = dn || emailLocal || 'Team member';
    const compact = identityName.replace(/\s+/g, '');
    identityInitials = compact.slice(0, 2).toUpperCase().padEnd(2, '·');
    if (prof?.avatar_url) identityAvatar = prof.avatar_url;
  }

  const identity: IdentityChipModel = {
    name: identityName,
    subtitle: membership.role,
    initials: identityInitials,
    avatarUrl: identityAvatar,
  };

  const connectStatus = tenantRow?.stripe_connect_status ?? 'not_started';

  const pendingRescheduleCount = await countPendingRescheduleRequests(
    supabase,
    membership.tenantId,
  );

  const admin = createAdminClient();
  const planTier = await resolveTenantPlanTier(admin, membership.tenantId);
  const campaignsNavEnabled = isFeatureEnabled(planTier, 'campaigns');

  const subscriptionLocked = needsSubscriptionPurchase(subscriptionAccess);
  const billingNavItem = buildTenantBillingNavItem(connectStatus);
  const settingsNavItem = buildTenantSettingsNavItem();

  const navItems: NavItem[] = subscriptionLocked
    ? [billingNavItem]
    : [
        ...NAV_ITEMS_BASE.slice(0, 6),
        billingNavItem,
        ...NAV_ITEMS_BASE.slice(6).filter(
          (item) => item.href !== '/campaigns' || campaignsNavEnabled,
        ),
        settingsNavItem,
      ].map((item) => {
        if (item.href !== '/schedule/reschedule-requests' || pendingRescheduleCount <= 0) {
          return item;
        }
        const badge = pendingRescheduleCount > 99 ? '99+' : pendingRescheduleCount;
        return { ...item, badge };
      });

  const sessionNotices: ReactNode[] = [];
  if (masquerading) sessionNotices.push(<MasqueradeExitBanner key="masq" />);
  if (shouldShowTrialPurchaseBanner(subscriptionAccess)) {
    sessionNotices.push(
      <TrialSubscriptionBanner
        key="trial"
        access={subscriptionAccess}
        daysRemaining={trialDaysLeft}
      />,
    );
  }
  if (subscriptionLocked) {
    sessionNotices.push(
      <WorkspacePausedBanner
        key="paused"
        access={subscriptionAccess}
        role={membership.role}
      />,
    );
  }
  if (!subscriptionLocked && connectStatus !== 'complete') {
    sessionNotices.push(<ConnectStatusBanner key="connect" status={connectStatus} />);
  }
  const sessionNotice = sessionNotices.length > 0 ? <>{sessionNotices}</> : null;

  return (
    <PortalShell
      brandLabel={slug}
      brandHref="/"
      navItems={navItems}
      identity={identity}
      tenantBadge={<span>{slug}.cleanscheduler.com</span>}
      environmentBanner={nonProdBanner}
      sessionNotice={sessionNotice}
      searchSlot={subscriptionLocked ? undefined : <GlobalSearch />}
      bottomNavItems={subscriptionLocked ? undefined : TENANT_BOTTOM_NAV}
    >
      {children}
    </PortalShell>
  );
}
