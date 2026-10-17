'use client';

import { useActionState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
  useFeedbackToast({ error: state.error, pending });
  return (
    <form action={action} className={styles.rowActions}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      <button type="submit" className={styles.dangerBtn} disabled={pending}>
        {pending ? '…' : 'Delete'}
      </button>
    </form>
  );
}
