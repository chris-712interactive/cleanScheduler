'use client';

import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { PersonAvatarChip } from './PersonAvatarChip';
import styles from './ScheduleAssigneeAvatars.module.scss';

export function ScheduleAssigneeAvatars({
  assignees,
  maxVisible = 4,
  className,
}: {
  assignees: ScheduleAssigneeChip[];
  maxVisible?: number;
  className?: string;
}) {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, maxVisible);
  const overflow = assignees.length - maxVisible;

  return (
    <div className={className ? `${styles.row} ${className}` : styles.row}>
      {visible.map((a) => (
        <PersonAvatarChip
          key={a.userId}
          firstName={a.firstName}
          displayName={a.displayName}
          avatarUrl={a.avatarUrl}
          initials={a.initials}
          variant="crew"
        />
      ))}
      {overflow > 0 ? <span className={styles.more}>+{overflow}</span> : null}
    </div>
  );
}
