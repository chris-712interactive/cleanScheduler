'use client';

/**
 * MobileBottomNav - icon + short-label navigation along the bottom edge of
 * the viewport on small screens. Shown only on `< md`. The customer portal
 * uses this; the tenant portal opts out and lets the drawer handle nav.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './types';
import { navIcons } from './navIcons';
import styles from './MobileBottomNav.module.scss';

export interface MobileBottomNavProps {
  items: NavItem[];
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Quick navigation" className={styles.nav}>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = navIcons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={styles.item}
            data-active={active || undefined}
          >
            {Icon ? <Icon size={20} aria-hidden="true" /> : null}
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
