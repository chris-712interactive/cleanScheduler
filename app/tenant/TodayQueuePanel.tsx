import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { DashboardTodayQueue } from '@/lib/tenant/dashboardTodayQueue';
import styles from './dashboard.module.scss';

export function TodayQueuePanel({
  queue,
  compactEmpty = false,
}: {
  queue: DashboardTodayQueue;
  compactEmpty?: boolean;
}) {
  if (queue.items.length === 0) {
    if (compactEmpty) {
      return (
        <p className={styles.todayEmptyInline}>
          Nothing urgent today — keep working through setup, or{' '}
          <Link href="/schedule">open the schedule</Link>.
        </p>
      );
    }

    return (
      <Card title="Today" titleHint="Your action queue for the day.">
        <p className={styles.queueEmpty}>
          Nothing urgent right now — open the schedule or billing hub when you are ready.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Today" titleHint="Start here — exceptions and collections first.">
      <ul className={styles.queueList}>
        {queue.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`${styles.queueItem} ${styles[`queueTone_${item.tone}`]}`}
            >
              <span className={styles.queueLabel}>{item.label}</span>
              <span className={styles.queueDetail}>{item.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
