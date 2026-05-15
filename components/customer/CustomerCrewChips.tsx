'use client';

import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { PersonAvatarChip } from '@/components/schedule/PersonAvatarChip';
import styles from './CustomerCrewChips.module.scss';

export function CustomerCrewChips({
  assignees,
  maxVisible = 4,
}: {
  assignees: ScheduleAssigneeChip[];
  maxVisible?: number;
}) {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, maxVisible);
  const overflow = assignees.length - maxVisible;

  return (
    <div className={styles.crew}>
      {visible.map((a) => (
        <div className={styles.member} key={a.userId}>
          <PersonAvatarChip
            firstName={a.firstName}
            displayName={a.displayName}
            avatarUrl={a.avatarUrl}
            initials={a.initials}
            variant="crew"
            size="xl"
          />
          <span className={styles.name}>{a.firstName}</span>
        </div>
      ))}
      {overflow > 0 ? <span className={styles.more}>+{overflow}</span> : null}
    </div>
  );
}
