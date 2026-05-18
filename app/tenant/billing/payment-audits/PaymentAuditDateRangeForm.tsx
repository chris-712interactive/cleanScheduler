'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { buildPaymentAuditSearchParams } from '@/lib/billing/paymentAuditDateRange';
import styles from '../billing.module.scss';

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
    <form method="get" className={styles.dateRangeForm}>
      {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
      <div className={styles.dateRangeFields}>
        <label className={styles.dateRangeField}>
          <span className={styles.dateRangeLabel}>From</span>
          <input
            type="date"
            name="from"
            className={styles.dateRangeInput}
            defaultValue={from}
          />
        </label>
        <label className={styles.dateRangeField}>
          <span className={styles.dateRangeLabel}>To</span>
          <input type="date" name="to" className={styles.dateRangeInput} defaultValue={to} />
        </label>
      </div>
      <div className={styles.dateRangeActions}>
        <Button type="submit" variant="secondary" size="sm">
          Apply range
        </Button>
        {hasRange ? (
          <Link href={`/billing/payment-audits${clearHref}`} className={styles.dateRangeClear}>
            Clear dates
          </Link>
        ) : null}
      </div>
    </form>
  );
}
