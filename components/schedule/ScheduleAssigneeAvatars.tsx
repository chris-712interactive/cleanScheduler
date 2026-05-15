'use client';

import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { PersonAvatarChip, type AvatarChipSize } from './PersonAvatarChip';
import styles from './ScheduleAssigneeAvatars.module.scss';

export function ScheduleAssigneeAvatars({
  assignees,
  maxVisible = 4,
  className,
  size = 'sm',
  layout = 'row',
}: {
  assignees: ScheduleAssigneeChip[];
  maxVisible?: number;
  className?: string;
  size?: AvatarChipSize;
  layout?: 'row' | 'column';
}) {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, maxVisible);
  const overflow = assignees.length - maxVisible;
  const moreClass =
    size === 'lg' ? styles.moreLg : size === 'md' ? styles.moreMd : styles.moreSm;

  const layoutClass = layout === 'column' ? styles.column : styles.row;

  return (
    <div className={className ? `${layoutClass} ${className}` : layoutClass}>
      {visible.map((a) => (
        <PersonAvatarChip
          key={a.userId}
          firstName={a.firstName}
          displayName={a.displayName}
          avatarUrl={a.avatarUrl}
          initials={a.initials}
          variant="crew"
          size={size}
        />
      ))}
      {overflow > 0 ? <span className={moreClass}>+{overflow}</span> : null}
    </div>
  );
}
