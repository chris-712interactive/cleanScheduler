'use client';

/**
 * Sidebar - the desktop navigation rail. Hidden on mobile (drawer takes over,
 * see TopBar.tsx). Highlights the active route based on usePathname().
 */
import { NavList } from './NavList';
import type { NavItem } from './types';
import styles from './Sidebar.module.scss';

export interface SidebarProps {
  items: NavItem[];
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Primary">
      <NavList items={items} />
    </aside>
  );
}
