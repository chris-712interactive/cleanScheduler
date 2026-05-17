'use client';

import type { AssigneeConflictInfo } from '@/lib/schedule/visitAssigneeConflicts';
import styles from './ScheduleOverlapConfirm.module.scss';

export function ScheduleOverlapConfirm({
  conflicts,
  showConfirmField,
  confirmChecked,
  onConfirmChange,
}: {
  conflicts: AssigneeConflictInfo[];
  showConfirmField: boolean;
  confirmChecked: boolean;
  onConfirmChange: (checked: boolean) => void;
}) {
  if (conflicts.length === 0) return null;

  return (
    <div className={styles.box} role="alert">
      <p className={styles.title}>Scheduling conflict</p>
      <p className={styles.intro}>
        Assigned crew already has another visit during this window:
      </p>
      <ul className={styles.list}>
        {conflicts.map((c) => (
          <li key={`${c.assigneeUserId}-${c.otherVisitId}`}>
            <strong>{c.assigneeName}</strong> — {c.otherVisitLabel}
            <span className={styles.when}> ({c.otherWhenLabel})</span>
          </li>
        ))}
      </ul>
      {showConfirmField ? (
        <label className={styles.confirmLabel}>
          <input
            type="checkbox"
            name="confirm_overlap"
            value="1"
            checked={confirmChecked}
            onChange={(e) => onConfirmChange(e.target.checked)}
          />
          I understand — schedule this overlap anyway
        </label>
      ) : null}
    </div>
  );
}
