'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  updateScheduleEligibilityAction,
  type ScheduleEligibilityActionState,
} from './scheduleEligibilityActions';
import styles from '../customers/scheduling-fields.module.scss';

const initial: ScheduleEligibilityActionState = {};

export function OfficeScheduleEligibilityForm({
  tenantSlug,
  targetUserId,
  excludeFromJobs,
  excludeFromConsultations,
}: {
  tenantSlug: string;
  targetUserId: string;
  excludeFromJobs: boolean;
  excludeFromConsultations: boolean;
}) {
  const [state, action, pending] = useActionState(updateScheduleEligibilityAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });

  return (
    <form action={action} className={styles.stack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <p className={styles.lead}>
        Leave both unchecked when this person also works in the field. Check both for someone who
        stays in the office.
      </p>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="exclude_from_jobs" defaultChecked={excludeFromJobs} /> Do not
          schedule for jobs
        </label>
        <label>
          <input
            type="checkbox"
            name="exclude_from_consultations"
            defaultChecked={excludeFromConsultations}
          />{' '}
          Do not schedule for consultations
        </label>
      </div>
      {excludeFromJobs && excludeFromConsultations ? (
        <p className={styles.lead}>
          Availability and the scheduling profile stay hidden while both are checked.
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save scheduling role'}
        </Button>
      </div>
    </form>
  );
}
