import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import {
  SCHEDULE_ISSUE_LABEL,
  type ScheduleIssueItem,
  type ScheduleIssueKind,
} from '@/lib/tenant/scheduleIssuesQueue';
import styles from './schedule.module.scss';

const ISSUE_TONE: Record<ScheduleIssueKind, 'warning' | 'danger' | 'info' | 'neutral'> = {
  needs_staffing: 'warning',
  schedule_conflict: 'danger',
  unpriced: 'warning',
  pending_reschedule: 'info',
};

function IssueBadge({ kind }: { kind: ScheduleIssueKind }) {
  return (
    <span className={styles.issueBadge} data-tone={ISSUE_TONE[kind]}>
      {SCHEDULE_ISSUE_LABEL[kind]}
    </span>
  );
}

export function ScheduleIssuesList({
  items,
  tenantTimezone,
}: {
  items: ScheduleIssueItem[];
  tenantTimezone: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No scheduling issues"
        description="Upcoming appointments with missing crew, conflicts, or other problems will appear here."
      />
    );
  }

  return (
    <section aria-labelledby="schedule-issues-heading">
      <h2 id="schedule-issues-heading" className={styles.srOnly}>
        Appointments needing attention
      </h2>
      <ul className={styles.issuesList}>
        {items.map((item) => (
          <li key={item.visitId}>
            <Link href={item.href} className={styles.issueCard}>
              <div className={styles.issueCardMain}>
                <p className={styles.issueCardCustomer}>{item.customerName}</p>
                <p className={styles.issueCardTitle}>{item.title}</p>
                <p className={styles.issueCardWhen}>
                  {formatVisitWhenRange(item.startsAt, item.endsAt, tenantTimezone)}
                </p>
              </div>
              <ul className={styles.issueBadgeList} aria-label="Issues">
                {item.issues.map((kind) => (
                  <li key={kind}>
                    <IssueBadge kind={kind} />
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
