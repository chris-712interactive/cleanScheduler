'use client';

import { useActionState, useEffect, useState } from 'react';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { OFFICE_SET_PRICE_HINT } from '@/lib/billing/resolveVisitExpectedAmount';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { updateVisitJobPrice, type ScheduleFormState } from './actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function VisitJobPriceForm({
  tenantSlug,
  visitId,
  currentAmountCents,
  onVisitPatch,
  compact = false,
}: {
  tenantSlug: string;
  visitId: string;
  currentAmountCents: number | null;
  onVisitPatch?: (patch: VisitDetailPatch) => void;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateVisitJobPrice, initial);
  useServerActionVisitPatch(state.success, state.visitPatch, onVisitPatch);

  const [amountDollars, setAmountDollars] = useState(() =>
    currentAmountCents != null && currentAmountCents > 0
      ? formatCentsAsDollars(currentAmountCents)
      : '',
  );

  useEffect(() => {
    if (currentAmountCents != null && currentAmountCents > 0) {
      setAmountDollars(formatCentsAsDollars(currentAmountCents));
    }
  }, [currentAmountCents]);

  if (compact) {
    return (
      <form action={formAction} className={styles.visitPriceCompact}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="visit_id" value={visitId} />
        <label className={styles.visitPriceCompactLabel} htmlFor="visit_job_price_edit">
          USD
        </label>
        <input
          id="visit_job_price_edit"
          name="job_price_dollars"
          type="number"
          className={styles.visitPriceCompactInput}
          min="0"
          step="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="150.00"
          required
        />
        <button type="submit" className={styles.visitPriceCompactBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.success} role="status">
            Saved.
          </p>
        ) : null}
        <p className={styles.visitPriceCompactHint}>{OFFICE_SET_PRICE_HINT}</p>
      </form>
    );
  }

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
        <label className={styles.label} htmlFor="visit_job_price_edit_full">
          Amount (USD)
        </label>
        <input
          id="visit_job_price_edit_full"
          name="job_price_dollars"
          type="number"
          className={styles.input}
          min="0"
          step="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
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
