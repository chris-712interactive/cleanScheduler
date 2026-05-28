'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { OFFICE_SET_PRICE_HINT } from '@/lib/billing/resolveVisitExpectedAmount';
import { updateVisitJobPrice, type ScheduleFormState } from './actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function VisitJobPriceForm({
  tenantSlug,
  visitId,
  currentAmountCents,
}: {
  tenantSlug: string;
  visitId: string;
  currentAmountCents: number | null;
}) {
  const [state, formAction, pending] = useActionState(updateVisitJobPrice, initial);
  useRefreshOnServerActionSuccess(state.success);

  const defaultDollars =
    currentAmountCents != null && currentAmountCents > 0
      ? formatCentsAsDollars(currentAmountCents)
      : '';

  return (
    <form action={formAction} className={styles.visitRescheduleCard}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />

      <p className={styles.visitRescheduleTitle}>Job price</p>
      <p className={styles.visitRescheduleHint}>{OFFICE_SET_PRICE_HINT}</p>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Job price saved.
        </p>
      ) : null}

      <div className={styles.formField}>
        <label className={styles.label} htmlFor="visit_job_price_edit">
          Amount (USD)
        </label>
        <input
          id="visit_job_price_edit"
          name="job_price_dollars"
          type="number"
          className={styles.input}
          min="0"
          step="0.01"
          defaultValue={defaultDollars}
          placeholder="150.00"
          required
        />
      </div>

      <div className={styles.visitRescheduleActions}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save job price'}
        </button>
      </div>
    </form>
  );
}
