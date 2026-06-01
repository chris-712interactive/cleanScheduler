import { Suspense } from 'react';
import { PortalShell } from '@/components/portal/PortalShell';
import { getNonProdPortalBanner } from '@/lib/portal/nonProdBanner';
import type { NavItem } from '@/components/portal/types';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { PRODUCT_NAME } from '@/lib/legal/site';
import { getPortalContext } from '@/lib/portal';
import { headers } from 'next/headers';
import { RouteContentShell } from '@/components/portal/RouteContentShell';
import { WebVitalsReporter } from '@/components/performance/WebVitalsReporter';
import { debugPerfStart } from '@/lib/performance/debugPerf';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalNavSkeleton } from '@/components/portal/portalNav/PortalNavSkeleton';
import { CustomerNavList } from '@/components/portal/portalNav/CustomerNavList';
import { CustomerWhiteLabelBrand } from '@/components/portal/portalNav/CustomerWhiteLabelBrand';
import { CustomerIdentityMenu } from '@/components/portal/portalNav/CustomerIdentityMenu';
import styles from './customer-layout.module.scss';

export const dynamic = 'force-dynamic';

const BOTTOM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/visits', icon: 'visits' },
  { label: 'Billing', href: '/invoices', icon: 'invoices' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
];

function CustomerBrandFallback() {
  return (
    <span className={styles.brandFallback} aria-busy="true">
      <Skeleton width={140} height={24} radius="md" />
    </span>
  );
}

function CustomerIdentityFallback() {
  return <Skeleton width={36} height={36} radius="pill" />;
}

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const internal = h.get('x-internal-pathname') ?? '';
  if (internal.startsWith('/customer/complete-invite')) {
    return <div className={styles.publicInvite}>{children}</div>;
  }

  const endLayout = debugPerfStart('customer.layout', internal);

  try {
    const auth = await requirePortalAccess('customer', '/');
    const nonProdBanner = getNonProdPortalBanner();
    const portal = await getPortalContext();
    const whiteLabel = Boolean(portal.whiteLabelCustomerPortal && portal.tenantSlug);

    return (
      <>
        <WebVitalsReporter portal="customer" />
        <PortalShell
          brandLabel={whiteLabel ? (portal.tenantSlug ?? 'Portal') : PRODUCT_NAME}
          brandSlot={
            whiteLabel && portal.tenantSlug ? (
              <Suspense fallback={<CustomerBrandFallback />}>
                <CustomerWhiteLabelBrand tenantSlug={portal.tenantSlug} />
              </Suspense>
            ) : undefined
          }
          hidePlatformLogo={whiteLabel}
          brandHref="/"
          sidebarNav={
            <Suspense fallback={<PortalNavSkeleton rows={6} />}>
              <CustomerNavList userId={auth.user.id} />
            </Suspense>
          }
          mobileNav={
            <Suspense fallback={<PortalNavSkeleton rows={6} />}>
              <CustomerNavList userId={auth.user.id} />
            </Suspense>
          }
          bottomNavItems={BOTTOM_NAV}
          identitySlot={
            <Suspense fallback={<CustomerIdentityFallback />}>
              <CustomerIdentityMenu userId={auth.user.id} />
            </Suspense>
          }
          tenantBadge={
            portal.whiteLabelHostname ? (
              <span>{portal.whiteLabelHostname}</span>
            ) : (
              <span>my.cleanscheduler.com</span>
            )
          }
          environmentBanner={nonProdBanner}
        >
          <RouteContentShell>{children}</RouteContentShell>
        </PortalShell>
      </>
    );
  } finally {
    endLayout();
  }
}
