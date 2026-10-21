'use client';

import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAccountNotices } from './AccountNoticesProvider';
import styles from './AccountNoticesMenu.module.scss';

export function AccountNoticesMenu() {
  const { notices } = useAccountNotices();
  const lead = notices[0];
  if (!lead) return null;

  const tone = lead.tone;

  if (notices.length === 1) {
    return (
      <Link
        href={lead.href}
        className={styles.trigger}
        data-tone={tone}
        title={lead.detail}
        aria-label={`${lead.label}. ${lead.detail}`}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.label}>{lead.label}</span>
      </Link>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          data-tone={tone}
          aria-label={`${lead.label}. ${notices.length} account notices`}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>{lead.label}</span>
          <span className={styles.count}>{notices.length}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} sideOffset={8} align="end">
          {notices.map((notice) => (
            <DropdownMenu.Item key={notice.id} asChild className={styles.item}>
              <Link href={notice.href} className={styles.menuLink}>
                <span className={styles.itemLabel}>{notice.label}</span>
                <span className={styles.itemDetail}>{notice.detail}</span>
                <span className={styles.itemAction}>{notice.actionLabel} →</span>
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
