'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { reportDatePresets, reportPresetHref } from '@/lib/reports/reportDatePresets';
import { buildReportSearchParams } from '@/lib/reports/parseReportDateRange';
import styles from './reports.module.scss';

export function ReportDateRangeForm({
  slug,
  from,
  to,
  showRange,
}: {
  slug: string;
  from: string;
  to: string;
  showRange: boolean;
}) {
  if (!showRange) {
    return (
      <p className={styles.hint}>
        Snapshot report — use the <strong>To</strong> date as the as-of date, or leave blank for
        today.
      </p>
    );
  }

  const hasRange = Boolean(from || to);
  const clearHref = `/reports/${slug}${buildReportSearchParams({})}`;
  const presets = reportDatePresets();

  return (
    <>
      <div className={styles.presetRow}>
        <span className={styles.presetLabel}>Presets</span>
        {presets.map((preset) => (
          <Link key={preset.id} href={reportPresetHref(slug, preset)} className={styles.presetLink}>
            {preset.label}
          </Link>
        ))}
      </div>
      <form method="get" className={styles.toolbar}>
        <div className={styles.dateFields}>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>From</span>
            <input type="date" name="from" className={styles.dateInput} defaultValue={from} />
          </label>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>To</span>
            <input type="date" name="to" className={styles.dateInput} defaultValue={to} />
          </label>
        </div>
        <div className={styles.toolbarActions}>
          <Button type="submit" variant="primary" size="sm">
            Apply range
          </Button>
          {hasRange ? (
            <Link href={clearHref} className={styles.clearDates}>
              Clear dates
            </Link>
          ) : null}
        </div>
      </form>
    </>
  );
}
