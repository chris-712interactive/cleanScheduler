'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { deleteScheduledVisit, type ScheduleFormState } from './actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function DeleteVisitButton({
  tenantSlug,
  visitId,
}: {
  tenantSlug: string;
  visitId: string;
}) {
  const [state, action, pending] = useActionState(deleteScheduledVisit, initial);
  useRefreshOnServerActionSuccess(state.success);
  return (
    <form action={action} className={styles.rowActions}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      {state.error ? (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      ) : null}
      <button type="submit" className={styles.dangerBtn} disabled={pending}>
        {pending ? '…' : 'Delete'}
      </button>
    </form>
  );
}
