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
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AccountMenu } from './AccountMenu';
import { NavList } from './NavList';
import type { IdentityChipModel, NavItem } from './types';
import styles from './TopBar.module.scss';

export interface TopBarProps {
  brandLabel: string;
  brandLogoUrl?: string | null;
  hidePlatformLogo?: boolean;
  brandHref?: string;
  /** When set, replaces the default brand link (e.g. streamed white-label branding). */
  brandSlot?: ReactNode;
  identity?: IdentityChipModel;
  /** When set, replaces the default account menu (e.g. streamed customer identity). */
  identitySlot?: ReactNode;
  settingsHref?: string;
  tenantBadge?: React.ReactNode;
  navItems?: NavItem[];
  /** Streamed nav tree for the mobile drawer (preferred over navItems). */
  mobileNav?: ReactNode;
  searchSlot?: React.ReactNode;
}

export function TopBar({
  brandLabel,
  brandLogoUrl,
  hidePlatformLogo = false,
  brandHref = '/',
  brandSlot,
  identity,
  identitySlot,
  settingsHref,
  tenantBadge,
  navItems,
  mobileNav,
  searchSlot,
}: TopBarProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
              {mobileNav ?? (navItems ? <NavList items={navItems} /> : null)}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {brandSlot ?? (
          <Link href={brandHref} className={styles.brand}>
            {!hidePlatformLogo ? (
              <span className={styles.brandMark}>
                <Image
                  src="/brand/logo.svg"
                  alt=""
                  width={160}
                  height={32}
                  className={styles.brandLogo}
                  priority
                />
              </span>
            ) : brandLogoUrl ? (
              <span className={styles.brandMark}>
                <Image
                  src={brandLogoUrl}
                  alt=""
                  width={160}
                  height={32}
                  className={styles.brandLogo}
                  priority
                  unoptimized
                />
              </span>
            ) : null}
            <span className={styles.brandLabel}>{brandLabel}</span>
          </Link>
        )}
        {tenantBadge ? <div className={styles.tenantBadge}>{tenantBadge}</div> : null}
      </div>

      <div className={styles.right}>
        {searchSlot}
        <ThemeToggle />
        {identitySlot ??
          (identity ? <AccountMenu {...identity} settingsHref={settingsHref} /> : null)}
      </div>
    </header>
  );
}
