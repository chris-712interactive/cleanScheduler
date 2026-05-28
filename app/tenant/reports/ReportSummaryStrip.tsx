import Link from 'next/link';
import type { ReportSummaryLine } from '@/lib/reports/types';
import styles from './reports.module.scss';

export function ReportSummaryStrip({ lines }: { lines: ReportSummaryLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className={styles.summaryStrip}>
      {lines.map((line) => (
        <div key={line.label} className={styles.summaryItem}>
          <p className={styles.summaryLabel}>{line.label}</p>
          <p className={styles.summaryValue}>{line.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportUpgradePanel({ minimumTierLabel }: { minimumTierLabel: string }) {
  return (
    <div className={styles.upgradePanel}>
      <h2 className={styles.upgradeTitle}>Upgrade to unlock this report</h2>
      <p className={styles.upgradeCopy}>
        {minimumTierLabel} plans include advanced analytics — payment reconciliation, revenue
        breakdowns, recurring revenue, and employee performance reports.
      </p>
      <Link href="/billing" className={styles.upgradeLink}>
        View workspace billing
      </Link>
    </div>
  );
}
