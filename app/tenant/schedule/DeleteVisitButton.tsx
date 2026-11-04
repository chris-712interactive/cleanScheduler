'use client';

import { useActionState } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { deleteScheduledVisit, type ScheduleFormState } from './actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function DeleteVisitButton({
  tenantSlug,
  visitId,
  requiresCoverageParty = false,
}: {
  tenantSlug: string;
  visitId: string;
  requiresCoverageParty?: boolean;
}) {
  const [state, action, pending] = useActionState(deleteScheduledVisit, initial);
  useFeedbackToast({ error: state.error, pending });
  return (
    <form action={action} className={styles.rowActions}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      {requiresCoverageParty ? (
        <label>
          Who cancelled
          <select name="coverage_party" required defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option value="company">Company</option>
            <option value="customer">Customer</option>
          </select>
        </label>
      ) : null}
      <button type="submit" className={styles.dangerBtn} disabled={pending}>
        {pending ? '…' : 'Delete'}
      </button>
    </form>
  );
}
