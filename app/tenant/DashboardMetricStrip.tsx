import Link from 'next/link';
import styles from './dashboard.module.scss';

export type DashboardMetricSlot = 'quotes' | 'jobs' | 'due' | 'revenue' | 'customers';
export type DashboardMetricTone = 'default' | 'quiet' | 'money' | 'warn';

export interface DashboardMetric {
  slot: DashboardMetricSlot;
  label: string;
  value: string;
  context: string;
  href: string;
  tone: DashboardMetricTone;
}

export function DashboardMetricStrip({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <div className={styles.metricBand}>
      {metrics.map((metric) => (
        <Link
          key={metric.slot}
          className={styles.metric}
          data-slot={metric.slot}
          href={metric.href}
        >
          <span className={styles.metricLabel}>{metric.label}</span>
          <span
            className={styles.metricValue}
            data-tone={metric.tone === 'default' ? undefined : metric.tone}
          >
            {metric.value}
          </span>
          <span className={styles.metricContext}>{metric.context}</span>
        </Link>
      ))}
    </div>
  );
}
