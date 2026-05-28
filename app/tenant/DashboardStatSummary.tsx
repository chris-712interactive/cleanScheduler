import { Card } from '@/components/ui/Card';
import styles from './dashboard.module.scss';

export interface DashboardStatSummaryProps {
  quotes: number;
  todaysJobs: number;
  outstanding: string;
  customers: number;
}

export function DashboardStatSummary({
  quotes,
  todaysJobs,
  outstanding,
  customers,
}: DashboardStatSummaryProps) {
  return (
    <Card title="At a glance" titleHint="Key counts while you set up.">
      <dl className={styles.statSummaryList}>
        <div className={styles.statSummaryRow}>
          <dt>Quotes</dt>
          <dd>{quotes}</dd>
        </div>
        <div className={styles.statSummaryRow}>
          <dt>Today&apos;s jobs</dt>
          <dd>{todaysJobs}</dd>
        </div>
        <div className={styles.statSummaryRow}>
          <dt>Outstanding</dt>
          <dd>{outstanding}</dd>
        </div>
        <div className={styles.statSummaryRow}>
          <dt>Customers</dt>
          <dd>{customers}</dd>
        </div>
      </dl>
    </Card>
  );
}
