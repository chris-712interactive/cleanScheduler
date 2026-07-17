import { Suspense, type ReactNode } from 'react';
import { PortalShell } from '@/components/portal/PortalShell';
import { MasqueradeExitBanner } from '@/components/portal/MasqueradeExitBanner';
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
import { getTenantBillingSnapshot, getTenantPortalMembership } from '@/lib/portal/requestContext';
import { buildTenantBottomNavItems } from '@/lib/tenant/buildTenantNavItems';
import {
  fieldEmployeeHomePath,
  identitySubtitleForRole,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';
import { expireStaleMasqueradeIfNeeded } from '@/lib/admin/expireStaleMasquerade';
import { RouteContentShell } from '@/components/portal/RouteContentShell';
import { WebVitalsReporter } from '@/components/performance/WebVitalsReporter';
import { debugPerfStart } from '@/lib/performance/debugPerf';
import { headers } from 'next/headers';
import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { PortalNavSkeleton } from '@/components/portal/portalNav/PortalNavSkeleton';
import { TenantNavList } from '@/components/portal/portalNav/TenantNavList';
import { TenantDeferredSessionNotices } from '@/components/portal/portalNav/TenantDeferredSessionNotices';

const GlobalSearchLazy = nextDynamic(
  () => import('@/components/portal/GlobalSearch').then((m) => ({ default: m.GlobalSearch })),
  {
    loading: () => <Skeleton width="100%" height={40} radius="md" />,
  },
);

export const dynamic = 'force-dynamic';

/**
 * Getting-started order (after business profile): customers → quotes → schedule
 * (`lib/tenant/portalBuildOrder.ts`). Sidebar keeps Quotes near the top for
 * day-to-day sales work once the directory exists.
 *
 * Phase 4: shell paints with membership + billing; nav badges and deferred
 * banners stream in via Suspense without blocking page content.
 */

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const browserPath = requestHeaders.get('x-tenant-pathname') ?? '/';
  const endLayout = debugPerfStart('tenant.layout', browserPath);

  try {
    const { tenantSlug } = await getPortalContext();
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

    const subscriptionLocked = needsSubscriptionPurchase(subscriptionAccess);
    const navShellParams = {
      tenantId: membership.tenantId,
      tenantSlug: slug,
      role: membership.role,
      roleId: membership.roleId,
      billingSnapshot,
    };

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
    const sessionNotice = sessionNotices.length > 0 ? <>{sessionNotices}</> : null;

    const navSuspenseFallback = <PortalNavSkeleton rows={subscriptionLocked ? 2 : 10} />;

    return (
      <>
        <WebVitalsReporter portal="tenant" />
        <PortalShell
          brandLabel={slug}
          brandHref={brandHref}
          sidebarNav={
            <Suspense fallback={navSuspenseFallback}>
              <TenantNavList {...navShellParams} />
            </Suspense>
          }
          mobileNav={
            <Suspense fallback={navSuspenseFallback}>
              <TenantNavList {...navShellParams} />
            </Suspense>
          }
          identity={identity}
          tenantBadge={<span>{slug}.cleanscheduler.com</span>}
          environmentBanner={nonProdBanner}
          sessionNotice={sessionNotice}
          deferredSessionNotice={
            !subscriptionLocked && !isFieldEmployeeRole(membership.role) ? (
              <Suspense fallback={null}>
                <TenantDeferredSessionNotices
                  tenantId={membership.tenantId}
                  tenantSlug={slug}
                  role={membership.role}
                  connectStatus={billingSnapshot.connectStatus}
                  subscriptionAccess={subscriptionAccess}
                />
              </Suspense>
            ) : null
          }
          searchSlot={showGlobalSearch ? <GlobalSearchLazy /> : undefined}
          bottomNavItems={bottomNavItems}
        >
          <RouteContentShell>{children}</RouteContentShell>
        </PortalShell>
      </>
    );
  } finally {
    endLayout();
  }
}
