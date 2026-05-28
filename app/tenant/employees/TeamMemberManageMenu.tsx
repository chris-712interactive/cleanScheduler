'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import styles from './employees.module.scss';

export function TeamMemberManageMenu({
  memberUserId,
  canEdit,
  isSelf,
}: {
  memberUserId: string;
  canEdit: boolean;
  isSelf: boolean;
}) {
  if (isSelf) {
    return (
      <Link href="/settings/account" className={styles.manageTrigger}>
        Manage
        <ChevronDown size={16} aria-hidden />
      </Link>
    );
  }

  if (!canEdit) {
    return <span className={styles.manageEmpty}>—</span>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.manageTrigger} aria-label="Manage team member">
          Manage
          <ChevronDown size={16} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menuPanel}
          sideOffset={4}
          align="end"
          collisionPadding={8}
        >
          <DropdownMenu.Item asChild>
            <Link href={`/employees/${memberUserId}`} className={styles.menuLink}>
              Edit member
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
