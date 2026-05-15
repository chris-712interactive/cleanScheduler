import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { TenantRole } from '@/lib/auth/types';
import styles from './employees.module.scss';

function initialsFrom(name: string, fallbackId: string): string {
  const t = name.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return fallbackId.slice(0, 2).toUpperCase();
}

export function TeamMemberRow({
  memberUserId,
  displayName,
  avatarUrl,
  role,
  isActive,
  isSelf,
  canEdit,
}: {
  memberUserId: string;
  displayName: string;
  avatarUrl: string | null;
  role: TenantRole;
  isActive: boolean;
  isSelf: boolean;
  canEdit: boolean;
}) {
  const label = displayName.trim() || `User ${memberUserId.slice(0, 8)}…`;

  return (
    <li className={styles.row}>
      <div className={styles.memberMain}>
        <div className={styles.thumb}>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" width={40} height={40} className={styles.thumbImg} />
          ) : (
            <span className={styles.thumbFallback} aria-hidden>
              {initialsFrom(label, memberUserId)}
            </span>
          )}
        </div>
        <div>
          <div className={styles.name}>
            {label}
            {isSelf ? <span className={styles.youBadge}>You</span> : null}
          </div>
          {isSelf ? (
            <p className={styles.meta}>Update your name and photo under Settings.</p>
          ) : role === 'owner' ? (
            <p className={styles.meta}>Workspace owner</p>
          ) : null}
        </div>
      </div>
      <div className={styles.memberSide}>
        <div className={styles.badges}>
          <StatusPill tone={isActive ? 'brand' : 'neutral'}>{role}</StatusPill>
          {!isActive ? <StatusPill tone="warning">Inactive</StatusPill> : null}
        </div>
        {canEdit ? (
          <Button as={Link} href={`/employees/${memberUserId}`} variant="secondary" size="sm">
            Edit
          </Button>
        ) : null}
      </div>
    </li>
  );
}
