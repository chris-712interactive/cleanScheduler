'use client';

/**
 * NavList - the actual <nav><ul> tree shared by the desktop Sidebar and the
 * mobile drawer in TopBar. Active state is computed from `usePathname()`:
 *
 *   - Items flagged `exact` match only their own href (avoids the dashboard
 *     item being highlighted whenever any descendant route is active).
 *   - Other items match if the pathname starts with their href + "/" (or
 *     equals it exactly), unless a more specific sibling item also matches
 *     (e.g. /schedule/reschedule-requests highlights only that item, not Schedule).
 *   - Items with `children` highlight for any route under their href; children
 *     render as an indented sub-list (e.g. Billing → Invoices, Transactions).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavChildActive, isNavItemActive } from './navActive';
import type { NavItem } from './types';
import { navIcons } from './navIcons';
import styles from './NavList.module.scss';

export interface NavListProps {
  items: NavItem[];
  onNavigate?: () => void;
}

export function NavList({ items, onNavigate }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav>
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item, items);
          const Icon = navIcons[item.icon];
          const children = item.children ?? [];

          return (
            <li key={item.href} className={children.length > 0 ? styles.group : undefined}>
              <Link
                href={item.href}
                aria-current={active && children.length === 0 ? 'page' : undefined}
                aria-expanded={children.length > 0 ? active : undefined}
                aria-label={
                  typeof item.badge === 'number' && item.badge > 0
                    ? `${item.label}, ${item.badge} pending`
                    : undefined
                }
                className={styles.item}
                data-active={active || undefined}
                onClick={onNavigate}
              >
                {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                <span className={styles.label}>{item.label}</span>
                {item.badge !== undefined ? (
                  <span className={styles.badge} aria-hidden="true">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
              {children.length > 0 ? (
                <ul className={styles.subList}>
                  {children.map((child) => {
                    const childActive = isNavChildActive(pathname, child, children);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? 'page' : undefined}
                          className={styles.subItem}
                          data-active={childActive || undefined}
                          onClick={onNavigate}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
