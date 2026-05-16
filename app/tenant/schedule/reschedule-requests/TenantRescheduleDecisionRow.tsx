'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import {
  resolveVisitRescheduleRequest,
  type ScheduleFormState,
} from '@/app/tenant/schedule/actions';
import styles from './rescheduleRequests.module.scss';

const initial: ScheduleFormState = {};

export function TenantRescheduleDecisionRow({
  tenantSlug,
  requestId,
}: {
  tenantSlug: string;
  requestId: string;
}) {
  const [state, formAction, pending] = useActionState(resolveVisitRescheduleRequest, initial);
  useRefreshOnServerActionSuccess(state.success);

  return (
    <form action={formAction} className={styles.decisionForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="request_id" value={requestId} />

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Updated.
        </p>
      ) : null}

      <label className={styles.srOnly} htmlFor={`note_${requestId}`}>
        Optional reply to customer
      </label>
      <textarea
        id={`note_${requestId}`}
        name="tenant_response_note"
        className={styles.noteInput}
        rows={2}
        placeholder="Optional note (shown internally only for now)"
        disabled={pending}
      />

      <div className={styles.decisionRow}>
        <label className={styles.radioLabel}>
          <input type="radio" name="resolution" value="completed" defaultChecked />
          Completed (time updated / agreed)
        </label>
        <label className={styles.radioLabel}>
          <input type="radio" name="resolution" value="declined" />
          Declined
        </label>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Submit'}
        </button>
      </div>
      <p className={styles.hint}>Update the appointment on its visit page before marking completed.</p>
    </form>
  );
}
