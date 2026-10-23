'use client';

import { useActionState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { reviewHoursChangeAction, type HoursChangeActionState } from './actions';
import styles from '../time-off/timeOff.module.scss';

const initial: HoursChangeActionState = {};

export function HoursChangeReviewRow({
  tenantSlug,
  requestId,
  employeeName,
  summary,
}: {
  tenantSlug: string;
  requestId: string;
  employeeName: string;
  summary: string;
}) {
  const [state, formAction, pending] = useActionState(reviewHoursChangeAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  return (
    <li className={styles.row}>
      <strong>{employeeName}</strong>
      <p className={styles.rowMeta}>{summary}</p>
      {state.success ? null : (
        <form action={formAction} className={styles.reviewActions}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="request_id" value={requestId} />
          <input
            className={styles.input}
            name="review_note"
            placeholder="Optional note"
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
