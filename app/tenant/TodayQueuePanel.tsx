import Link from 'next/link';
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

    return null;
  }

  return (
    <section className={styles.queue} aria-label="Today">
      <h2 className={styles.queueTitle}>Today</h2>
      <ul className={styles.queueList}>
        {queue.items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className={styles.queueRow}>
              <span className={styles.queueDot} data-tone={item.tone} aria-hidden />
              <span className={styles.queueCopy}>
                <span className={styles.queueLabel}>{item.label}</span>
                <span className={styles.queueDetail}>{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
