'use client';

/**
 * NavList - the actual <nav><ul> tree shared by the desktop Sidebar and the
 * mobile drawer in TopBar. Active state is computed from `usePathname()`:
 *
 *   - Items flagged `exact` match only their own href (avoids the dashboard
 *     item being highlighted whenever any descendant route is active).
 *   - Other items match if the pathname starts with their href + "/" (or
 *     equals it exactly).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './types';
import { navIcons } from './navIcons';
import styles from './NavList.module.scss';

export interface NavListProps {
  items: NavItem[];
  onNavigate?: () => void;
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

export function NavList({ items, onNavigate }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav>
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isItemActive(pathname, item);
          const Icon = navIcons[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
