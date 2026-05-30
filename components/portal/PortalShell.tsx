/**
 * PortalShell - the unified frame applied to every authenticated portal
 * (Founder Admin, Tenant, Customer). Per implementation plan section 18:
 *
 *   - Top bar (sticky, contains brand + search + theme toggle + identity)
 *   - Left sidebar nav on >= md viewports, slide-out drawer on mobile
 *   - Optional mobile bottom nav (customer portal opts in to this)
 *   - Main content region with skip-link target for keyboard users
 *
 * Route groups feed in their portal-specific nav items; the shell knows
 * nothing portal-specific.
 */
import type { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import type { IdentityChipModel, NavItem } from './types';
import styles from './PortalShell.module.scss';

export interface PortalShellProps {
  /** Static nav items (admin portal). Omit when using sidebarNav. */
  navItems?: NavItem[];
  /** Streamed sidebar nav (tenant/customer portals). */
  sidebarNav?: ReactNode;
  /** Streamed mobile drawer nav; defaults to sidebarNav when omitted. */
  mobileNav?: ReactNode;
  bottomNavItems?: NavItem[];
  brandLabel: string;
  brandLogoUrl?: string | null;
  /** When true, hide the cleanScheduler mark and show tenant logo or label only. */
  hidePlatformLogo?: boolean;
  brandHref?: string;
  /** Replaces default brand link (e.g. streamed white-label branding). */
  brandSlot?: ReactNode;
  identity?: IdentityChipModel;
  /** Replaces default account menu (e.g. streamed customer identity). */
  identitySlot?: ReactNode;
  /** Account menu link; omit to hide Settings in the menu. Defaults to `/settings`. */
  settingsHref?: string;
  tenantBadge?: ReactNode;
  /** Non-production warning (e.g. dev/staging) shown above the top bar. */
  environmentBanner?: ReactNode;
  /** Optional banner (e.g. masquerade exit) below env banner, above the top bar. */
  sessionNotice?: ReactNode;
  /** Streamed session banners (connect/usage) below sessionNotice. */
  deferredSessionNotice?: ReactNode;
  /** Optional center slot (e.g. tenant global search). */
  searchSlot?: ReactNode;
  children: ReactNode;
}

export function PortalShell({
  navItems,
  sidebarNav,
  mobileNav,
  bottomNavItems,
  brandLabel,
  brandLogoUrl,
  hidePlatformLogo = false,
  brandHref = '/',
  brandSlot,
  identity,
  identitySlot,
  settingsHref = '/settings',
  tenantBadge,
  environmentBanner,
  sessionNotice,
  deferredSessionNotice,
  searchSlot,
  children,
}: PortalShellProps) {
  const hasBottomNav = Boolean(bottomNavItems && bottomNavItems.length > 0);

  return (
    <div className={styles.shell} data-bottom-nav={hasBottomNav || undefined}>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {environmentBanner ? (
        <div className={styles.environmentBanner} role="status">
          {environmentBanner}
        </div>
      ) : null}
      {sessionNotice ? (
        <div className={styles.sessionNotice} role="region" aria-label="Session notice">
          {sessionNotice}
        </div>
      ) : null}
      {deferredSessionNotice ? (
        <div className={styles.sessionNotice} role="region" aria-label="Account notice">
          {deferredSessionNotice}
        </div>
      ) : null}
      <TopBar
        brandLabel={brandLabel}
        brandLogoUrl={brandLogoUrl}
        hidePlatformLogo={hidePlatformLogo}
        brandHref={brandHref}
        brandSlot={brandSlot}
        identity={identity}
        identitySlot={identitySlot}
        settingsHref={settingsHref}
        tenantBadge={tenantBadge}
        navItems={navItems}
        mobileNav={mobileNav ?? sidebarNav}
        searchSlot={searchSlot}
      />
      <div className={styles.body}>
        {sidebarNav ? <Sidebar>{sidebarNav}</Sidebar> : <Sidebar items={navItems} />}
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
      {bottomNavItems && bottomNavItems.length > 0 ? (
        <MobileBottomNav items={bottomNavItems} />
      ) : null}
    </div>
  );
}
