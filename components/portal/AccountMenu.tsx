'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Settings } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SignOutButton } from '@/components/auth/SignOutButton';
import type { IdentityChipModel } from './types';
import styles from './AccountMenu.module.scss';

export function AccountMenu({
  name,
  subtitle,
  initials,
  avatarUrl,
  settingsHref = '/settings',
}: IdentityChipModel & { settingsHref?: string }) {
  const fallback = initials ?? name.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          aria-label={`Account menu for ${name}`}
          aria-haspopup="menu"
        >
          <span className={styles.avatar} aria-hidden="true">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={32} height={32} />
            ) : (
              <span className={styles.initials}>{fallback}</span>
            )}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{name}</span>
            {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          </span>
          <ChevronDown size={16} className={styles.chevron} aria-hidden />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} sideOffset={8} align="end">
          <div className={styles.header}>
            <p className={styles.headerName}>{name}</p>
            {subtitle ? <p className={styles.headerSubtitle}>{subtitle}</p> : null}
          </div>

          {settingsHref ? (
            <DropdownMenu.Item asChild className={styles.item}>
              <Link href={settingsHref} className={styles.menuLink}>
                <Settings size={16} aria-hidden />
                Settings
              </Link>
            </DropdownMenu.Item>
          ) : null}

          <DropdownMenu.Item asChild className={styles.item} onSelect={(e) => e.preventDefault()}>
            <SignOutButton />
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
