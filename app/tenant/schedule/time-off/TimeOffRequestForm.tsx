'use client';

import { useActionState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  cancelTimeOffRequestAction,
  submitTimeOffRequestAction,
  type TimeOffActionState,
} from './actions';
import styles from './timeOff.module.scss';

const initial: TimeOffActionState = {};

export function TimeOffRequestForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(submitTimeOffRequestAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input
        type="hidden"
        name="client_timezone_offset"
        value={String(new Date().getTimezoneOffset())}
      />
      <div className={styles.gridTwo}>
        <label className={styles.label}>
          Starts
          <input className={styles.input} type="datetime-local" name="starts_at" required />
        </label>
        <label className={styles.label}>
          Ends
          <input className={styles.input} type="datetime-local" name="ends_at" required />
        </label>
      </div>
      <label className={styles.label}>
        Note (optional)
        <textarea
          className={styles.textarea}
          name="request_note"
          rows={3}
          placeholder="Vacation, appointment…"
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Submitting…' : 'Request time off'}
      </button>
    </form>
  );
}

export function CancelTimeOffButton({
  tenantSlug,
  requestId,
}: {
  tenantSlug: string;
  requestId: string;
}) {
  const [state, formAction, pending] = useActionState(cancelTimeOffRequestAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="request_id" value={requestId} />
      <button type="submit" className={styles.linkButton} disabled={pending}>
        Cancel
      </button>
    </form>
  );
}
