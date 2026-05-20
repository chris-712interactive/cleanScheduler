'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { buildPaymentAuditSearchParams } from '@/lib/billing/paymentAuditDateRange';
import styles from './paymentAudits.module.scss';

export function PaymentAuditDateRangeForm({
  filter,
  from,
  to,
}: {
  filter: string;
  from: string;
  to: string;
}) {
  const hasRange = Boolean(from || to);
  const clearHref = buildPaymentAuditSearchParams({
    filter: filter !== 'all' ? filter : undefined,
  });

  return (
    <form method="get" className={styles.toolbar}>
      {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
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
          <Link href={`/billing/payment-audits${clearHref}`} className={styles.clearDates}>
            Clear dates
          </Link>
        ) : null}
      </div>
    </form>
  );
}
