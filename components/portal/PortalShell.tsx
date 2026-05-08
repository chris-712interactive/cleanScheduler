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
  navItems: NavItem[];
  bottomNavItems?: NavItem[];
  brandLabel: string;
  brandHref?: string;
  identity?: IdentityChipModel;
  tenantBadge?: ReactNode;
  children: ReactNode;
}

export function PortalShell({
  navItems,
  bottomNavItems,
  brandLabel,
  brandHref = '/',
  identity,
  tenantBadge,
  children,
}: PortalShellProps) {
  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <TopBar
        brandLabel={brandLabel}
        brandHref={brandHref}
        identity={identity}
        tenantBadge={tenantBadge}
        navItems={navItems}
      />
      <div className={styles.body}>
        <Sidebar items={navItems} />
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
