import { PortalShell } from '@/components/portal/PortalShell';
import { MasqueradeExitBanner } from '@/components/portal/MasqueradeExitBanner';
import { UsageUtilizationBanner } from '@/components/billing/UsageUtilizationBanner';
import { ConnectStatusBanner } from '@/components/billing/ConnectStatusBanner';
import { TrialSubscriptionBanner } from '@/components/billing/TrialSubscriptionBanner';
import { WorkspacePausedBanner } from '@/components/billing/WorkspacePausedBanner';
import {
  needsSubscriptionPurchase,
  shouldShowTrialPurchaseBanner,
  trialDaysRemaining,
} from '@/lib/billing/tenantSubscriptionAccess';
import { getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { getPortalContext } from '@/lib/portal';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { IdentityChipModel } from '@/components/portal/types';
import { getAuthContext } from '@/lib/auth/session';
import {
  getCachedOwnerOnboardingNavContext,
  getCachedPendingRescheduleCount,
  getCachedTenantUsageUtilizationAlert,
} from '@/lib/portal/cachedNavChrome';
import {
  getTenantBillingSnapshot,
  getTenantEntitlementPlan,
  getTenantPortalMembership,
} from '@/lib/portal/requestContext';
import { buildTenantBillingNavItem } from '@/lib/tenant/buildTenantBillingNav';
import { buildTenantSettingsNavItem } from '@/lib/tenant/buildTenantSettingsNav';
import { buildTenantBottomNavItems, buildTenantNavItems } from '@/lib/tenant/buildTenantNavItems';
import {
  fieldEmployeeHomePath,
  identitySubtitleForRole,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';
import { isFeatureEnabled } from '@/lib/billing/entitlements';
import { expireStaleMasqueradeIfNeeded } from '@/lib/admin/expireStaleMasquerade';
import { RouteContentShell } from '@/components/portal/RouteContentShell';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import type { TenantStripeConnectStatus } from '@/components/billing/ConnectStatusBanner';

const GlobalSearchLazy = nextDynamic(
  () => import('@/components/portal/GlobalSearch').then((m) => ({ default: m.GlobalSearch })),
  {
    loading: () => <Skeleton width="100%" height={40} radius="md" />,
  },
);

export const dynamic = 'force-dynamic';

/**
 * Sidebar order matches product build priority for net-new tenant work (after
 * Dashboard): quotes → customers → schedule (`lib/tenant/portalBuildOrder.ts`).
 */

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = await getPortalContext();
  const requestHeaders = await headers();
  const browserPath = requestHeaders.get('x-tenant-pathname') ?? '/';
  const membership = await getTenantPortalMembership(tenantSlug ?? '', browserPath);
  const slug = membership.tenantSlug;

  const nonProdBanner = getNonProdPortalBanner();
  const auth = await getAuthContext();
  if (auth) {
    await expireStaleMasqueradeIfNeeded(auth);
  }
  const masquerading =
    Boolean(auth?.claims.masqueradeTargetTenantId) &&
    (auth?.claims.appRole === 'super_admin' || auth?.claims.appRole === 'admin');

  const billingSnapshot = await getTenantBillingSnapshot(membership.tenantId);
  const { subscriptionAccess } = billingSnapshot;
  const trialDaysLeft = trialDaysRemaining(billingSnapshot.trialEndsAt);
  const purgeStatus = getTenantPurgeStatus({
    activated_at: billingSnapshot.activatedAt,
    trial_ends_at: billingSnapshot.trialEndsAt,
    stripe_subscription_id: billingSnapshot.stripeSubscriptionId,
  });

  const supabase = createTenantPortalDbClient();

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
    subtitle: identitySubtitleForRole(membership.role),
    initials: identityInitials,
    avatarUrl: identityAvatar,
  };

  const connectStatus = (billingSnapshot.connectStatus ??
    'not_started') as TenantStripeConnectStatus;

  const pendingRescheduleCount = await getCachedPendingRescheduleCount(membership.tenantId);

  const subscriptionLocked = needsSubscriptionPurchase(subscriptionAccess);
  const planTier = await getTenantEntitlementPlan(membership.tenantId);
  const campaignsNavEnabled = isFeatureEnabled(planTier, 'campaigns');
  const usageUtilizationAlert =
    !subscriptionLocked && !isFieldEmployeeRole(membership.role)
      ? await getCachedTenantUsageUtilizationAlert(membership.tenantId)
      : null;

  const { gettingStartedNavItem, coreSetupComplete } = subscriptionLocked
    ? { gettingStartedNavItem: null, coreSetupComplete: true }
    : await getCachedOwnerOnboardingNavContext({
        tenantId: membership.tenantId,
        tenantSlug: slug,
        role: membership.role,
        connectStatus,
      });

  const billingNavItem = buildTenantBillingNavItem();
  const settingsNavItem = buildTenantSettingsNavItem();

  const navItems = buildTenantNavItems({
    role: membership.role,
    subscriptionLocked,
    billingNavItem,
    settingsNavItem,
    campaignsNavEnabled,
    pendingRescheduleCount,
    gettingStartedNavItem,
  });

  const bottomNavItems = buildTenantBottomNavItems({
    role: membership.role,
    subscriptionLocked,
  });

  const showGlobalSearch = !subscriptionLocked && !isFieldEmployeeRole(membership.role);
  const brandHref = isFieldEmployeeRole(membership.role) ? fieldEmployeeHomePath() : '/';

  const sessionNotices: ReactNode[] = [];
  if (masquerading) sessionNotices.push(<MasqueradeExitBanner key="masq" />);
  if (shouldShowTrialPurchaseBanner(subscriptionAccess) && !subscriptionLocked) {
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
        purgeStatus={purgeStatus}
      />,
    );
  }
  if (
    !subscriptionLocked &&
    coreSetupComplete &&
    connectStatus !== 'complete' &&
    !isFieldEmployeeRole(membership.role)
  ) {
    sessionNotices.push(<ConnectStatusBanner key="connect" status={connectStatus} />);
  }
  if (usageUtilizationAlert) {
    sessionNotices.push(<UsageUtilizationBanner key="usage" alert={usageUtilizationAlert} />);
  }
  const sessionNotice = sessionNotices.length > 0 ? <>{sessionNotices}</> : null;

  return (
    <PortalShell
      brandLabel={slug}
      brandHref={brandHref}
      navItems={navItems}
      identity={identity}
      tenantBadge={<span>{slug}.cleanscheduler.com</span>}
      environmentBanner={nonProdBanner}
      sessionNotice={sessionNotice}
      searchSlot={showGlobalSearch ? <GlobalSearchLazy /> : undefined}
      bottomNavItems={bottomNavItems}
    >
      <RouteContentShell>{children}</RouteContentShell>
    </PortalShell>
  );
}
