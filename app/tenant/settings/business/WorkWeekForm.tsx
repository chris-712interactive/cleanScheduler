'use client';

import { useActionState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import {
  WORK_WEEK_DAY_KEYS,
  WORK_WEEK_DAY_LABEL,
  buildWorkTimeOptions,
  type TenantBusinessSnapshot,
} from '@/lib/tenant/tenantBusinessSettings';
import { updateWorkWeekAction, type BusinessSettingsActionState } from './businessActions';
import styles from '../settings.module.scss';

const initial: BusinessSettingsActionState = {};

export function WorkWeekForm({
  tenantSlug,
  snapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateWorkWeekAction, initial);
  useRefreshOnServerActionSuccess(state.success);
  const timeOptions = buildWorkTimeOptions();
  const selectedDays = new Set(snapshot.workWeekDays);

  return (
    <form action={formAction} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.formSuccess} role="status">
          {state.success}
        </p>
      ) : null}

      <span className={styles.fieldLabel}>Work week</span>
      <div className={styles.dayToggleRow} role="group" aria-label="Work week">
        {WORK_WEEK_DAY_KEYS.map((day) => (
          <label key={day} className={styles.dayToggle}>
            <input
              type="checkbox"
              name={`work_day_${day}`}
              defaultChecked={selectedDays.has(day)}
              disabled={readOnly}
            />
            <span>{WORK_WEEK_DAY_LABEL[day]}</span>
          </label>
        ))}
      </div>

      <div className={styles.timeGrid}>
        <div>
          <label className={styles.fieldLabel} htmlFor="work_day_start">
            Default start time
          </label>
          <select
            id="work_day_start"
            name="work_day_start"
            className={styles.fieldSelect}
            defaultValue={snapshot.workDayStart}
            disabled={readOnly}
          >
            {timeOptions.map((option) => (
              <option key={`start-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="work_day_end">
            Default end time
          </label>
          <select
            id="work_day_end"
            name="work_day_end"
            className={styles.fieldSelect}
            defaultValue={snapshot.workDayEnd}
            disabled={readOnly}
          >
            {timeOptions.map((option) => (
              <option key={`end-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!readOnly ? (
        <button type="submit" className={styles.saveButton} disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      ) : null}
    </form>
  );
}
