'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';
import {
  updateScheduledVisitTimes,
  type ScheduleFormState,
} from '@/app/tenant/schedule/actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function VisitTimeRescheduleForm({
  tenantSlug,
  tenantTimezone,
  visitId,
  startsAtIso,
  endsAtIso,
}: {
  tenantSlug: string;
  tenantTimezone: string;
  visitId: string;
  startsAtIso: string;
  endsAtIso: string;
}) {
  const [state, formAction, pending] = useActionState(updateScheduledVisitTimes, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [startsLocal, setStartsLocal] = useState('');
  const [endsLocal, setEndsLocal] = useState('');

  useEffect(() => {
    setStartsLocal(isoToLocalDatetimeLocalValue(startsAtIso, tenantTimezone));
    setEndsLocal(isoToLocalDatetimeLocalValue(endsAtIso, tenantTimezone));
  }, [startsAtIso, endsAtIso, tenantTimezone]);

  return (
    <form action={formAction} className={styles.visitRescheduleCard}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      <input
        type="hidden"
        name="client_timezone_offset"
        value={String(new Date().getTimezoneOffset())}
      />

      <p className={styles.visitRescheduleTitle}>Change appointment time</p>
      <p className={styles.visitRescheduleHint}>
        Adjust start and end. Crew assignment stays as-is unless you edit on another screen.
      </p>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Visit time saved.
        </p>
      ) : null}

      <div className={styles.visitRescheduleGrid}>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_edit_starts_at">
            Start
          </label>
          <input
            id="visit_edit_starts_at"
            name="starts_at"
            type="datetime-local"
            className={styles.input}
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
            required
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_edit_ends_at">
            End
          </label>
          <input
            id="visit_edit_ends_at"
            name="ends_at"
            type="datetime-local"
            className={styles.input}
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.visitRescheduleActions}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save new time'}
        </button>
      </div>
    </form>
  );
}
