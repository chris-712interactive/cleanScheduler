'use client';

/**
 * Top bar - sticky header containing the brand mark, optional tenant badge,
 * a slot for global search (TODO), the theme toggle, and the identity chip.
 *
 * On viewports below `md`, the sidebar collapses behind a hamburger button
 * rendered here; tapping it opens a Radix Dialog that hosts the same nav
 * tree as the desktop sidebar.
 */
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AccountMenu } from './AccountMenu';
import { NavList } from './NavList';
import type { IdentityChipModel, NavItem } from './types';
import styles from './TopBar.module.scss';

export interface TopBarProps {
  brandLabel: string;
  brandHref?: string;
  identity?: IdentityChipModel;
  settingsHref?: string;
  tenantBadge?: React.ReactNode;
  navItems: NavItem[];
}

export function TopBar({
  brandLabel,
  brandHref = '/',
  identity,
  settingsHref,
  tenantBadge,
  navItems,
}: TopBarProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <Dialog.Trigger asChild>
            <button type="button" aria-label="Open navigation menu" className={styles.menuButton}>
              <Menu size={20} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.drawerOverlay} />
            <Dialog.Content className={styles.drawerContent} aria-describedby={undefined}>
              <Dialog.Title className={styles.drawerTitle}>{brandLabel}</Dialog.Title>
              <NavList items={navItems} onNavigate={() => setMobileNavOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Link href={brandHref} className={styles.brand}>
          <span className={styles.brandMark}>
            <img src="/brand/logo.svg" alt="" className={styles.brandLogo} decoding="async" />
          </span>
          <span className={styles.brandLabel}>{brandLabel}</span>
        </Link>
        {tenantBadge ? <div className={styles.tenantBadge}>{tenantBadge}</div> : null}
      </div>

      <div className={styles.right}>
        <ThemeToggle />
        {identity ? <AccountMenu {...identity} settingsHref={settingsHref} /> : null}
      </div>
    </header>
  );
}
