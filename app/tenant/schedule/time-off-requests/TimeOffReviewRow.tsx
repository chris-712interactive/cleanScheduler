'use client';

import { useActionState } from 'react';
import { reviewTimeOffRequestAction, type TimeOffActionState } from '../time-off/actions';
import styles from '../time-off/timeOff.module.scss';

const initial: TimeOffActionState = {};

export function TimeOffReviewRow({
  tenantSlug,
  requestId,
  employeeName,
  windowLabel,
  requestNote,
}: {
  tenantSlug: string;
  requestId: string;
  employeeName: string;
  windowLabel: string;
  requestNote: string;
}) {
  const [state, formAction, pending] = useActionState(reviewTimeOffRequestAction, initial);

  return (
    <li className={styles.row}>
      <strong>{employeeName}</strong>
      <p className={styles.rowMeta}>{windowLabel}</p>
      {requestNote ? <p className={styles.rowMeta}>{requestNote}</p> : null}
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          {state.success}
        </p>
      ) : (
        <form action={formAction} className={styles.reviewActions}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="request_id" value={requestId} />
          <input
            className={styles.input}
            name="review_note"
            placeholder="Optional note to employee"
            aria-label="Review note"
          />
          <button
            type="submit"
            name="decision"
            value="approved"
            className={styles.approveBtn}
            disabled={pending}
          >
            Approve
          </button>
          <button
            type="submit"
            name="decision"
            value="denied"
            className={styles.denyBtn}
            disabled={pending}
          >
            Deny
          </button>
        </form>
      )}
    </li>
  );
}
