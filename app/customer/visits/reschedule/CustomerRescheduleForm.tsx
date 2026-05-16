'use client';

import { useActionState } from 'react';
import {
  submitCustomerVisitRescheduleRequest,
  type CustomerRescheduleFormState,
} from './actions';
import styles from './reschedule.module.scss';

const initial: CustomerRescheduleFormState = {};

export function CustomerRescheduleForm({
  visitId,
  currentStartsAt,
  currentEndsAt,
}: {
  visitId: string;
  currentStartsAt: string;
  currentEndsAt: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitCustomerVisitRescheduleRequest,
    initial,
  );

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="visit_id" value={visitId} />
      <input
        type="hidden"
        name="client_timezone_offset"
        value={String(new Date().getTimezoneOffset())}
      />

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <p className={styles.intro}>
        Your provider confirms all changes to the calendar. Prefer a specific time window? Add it
        below — they&apos;ll propose an option or reply in messages.
      </p>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="preferred_starts_at">
            Preferred start (optional)
          </label>
          <input
            id="preferred_starts_at"
            name="preferred_starts_at"
            type="datetime-local"
            className={styles.input}
            defaultValue=""
          />
          <span className={styles.hint}>
            Leave blank if you’re only requesting a callback. If set, end time defaults to match your
            current visit length (~
            {formatDurationApprox(currentStartsAt, currentEndsAt)}).
          </span>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="preferred_ends_at">
            Preferred end (optional)
          </label>
          <input
            id="preferred_ends_at"
            name="preferred_ends_at"
            type="datetime-local"
            className={styles.input}
            defaultValue=""
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="customer_note">
          Message to your provider
        </label>
        <textarea
          id="customer_note"
          name="customer_note"
          className={styles.textarea}
          rows={4}
          placeholder="e.g. I need mornings only this week…"
          required={false}
        />
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Sending…' : 'Submit reschedule request'}
        </button>
      </div>
    </form>
  );
}

function formatDurationApprox(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'same length';
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(ms / 60_000)} min`;
  const rounded = Math.round(h * 10) / 10;
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}
