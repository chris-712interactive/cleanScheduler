'use client';

/**
 * MobileBottomNav - icon + short-label navigation along the bottom edge of
 * the viewport on small screens. Shown only on `< md`. Customer and tenant
 * portals opt in; other routes use the drawer for full navigation.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavItemActive } from './navActive';
import { markPortalNavPending } from './portalNavPending';
import { useClearPortalNavPendingOnNavigate } from './useClearPortalNavPendingOnNavigate';
import type { NavItem } from './types';
import { navIcons } from './navIcons';
import styles from './MobileBottomNav.module.scss';

export interface MobileBottomNavProps {
  items: NavItem[];
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  useClearPortalNavPendingOnNavigate();

  return (
    <nav aria-label="Quick navigation" className={styles.nav}>
      {items.map((item) => {
        const active = isNavItemActive(pathname, item, items);
        const Icon = navIcons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={styles.item}
            data-active={active || undefined}
            onClick={() => {
              if (!active) {
                markPortalNavPending();
              }
            }}
          >
            {Icon ? <Icon size={20} aria-hidden="true" /> : null}
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
