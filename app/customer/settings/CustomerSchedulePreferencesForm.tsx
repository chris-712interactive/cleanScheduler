'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import type { PreferredTimeWindow } from '@/lib/schedule/optimizer/preferences';
import {
  WORK_WEEK_DAY_KEYS,
  WORK_WEEK_DAY_LABEL,
  type WorkWeekDayKey,
} from '@/lib/tenant/tenantBusinessSettings';
import {
  updateCustomerSchedulePreferencesAction,
  type CustomerSchedulePreferenceState,
} from './actions';
import styles from './settings.module.scss';

const initial: CustomerSchedulePreferenceState = {};

export function CustomerSchedulePreferencesForm({
  tenantId,
  tenantName,
  customerId,
  showCompanyName,
  weekdays,
  timeWindow,
}: {
  tenantId: string;
  tenantName: string;
  customerId: string;
  showCompanyName: boolean;
  weekdays: WorkWeekDayKey[];
  timeWindow: PreferredTimeWindow | null;
}) {
  const [state, action, pending] = useActionState(updateCustomerSchedulePreferencesAction, initial);
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Saved. Your cleaner will aim for these days and times.',
    pending,
  });
  const chosen = new Set(weekdays);

  return (
    <form action={action} className={styles.scheduleForm}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="customer_id" value={customerId} />
      {showCompanyName ? <p className={styles.companyName}>{tenantName}</p> : null}

      <fieldset className={styles.days}>
        <legend>Days that work</legend>
        <div className={styles.dayList}>
          {WORK_WEEK_DAY_KEYS.map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                name="preferred_weekday"
                value={day}
                defaultChecked={chosen.has(day)}
              />
              {WORK_WEEK_DAY_LABEL[day]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.hint}>
        Leave every day unchecked if any day is fine. If none of these days are open, the next
        workday is used.
      </p>

      <label className={styles.timeField}>
        Time of day
        <select name="preferred_time_window" defaultValue={timeWindow ?? ''}>
          <option value="">Any time</option>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
        </select>
      </label>
      <p className={styles.hint}>
        Morning starts around 8:00, afternoon around noon, and evening around 4:00.
      </p>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </form>
  );
}
