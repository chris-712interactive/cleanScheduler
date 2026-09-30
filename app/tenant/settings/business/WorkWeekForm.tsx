'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { SettingsSaveButton } from '../SettingsSaveButton';
import {
  WORK_WEEK_DAY_LABEL,
  buildWorkTimeOptions,
  type TenantBusinessSnapshot,
  type WorkDaySchedule,
} from '@/lib/tenant/tenantBusinessSettings';
import { updateWorkWeekAction, type BusinessSettingsActionState } from './businessActions';
import styles from '../settings.module.scss';

const initial: BusinessSettingsActionState = {};

function updateDay(
  days: WorkDaySchedule[],
  weekday: WorkDaySchedule['weekday'],
  patch: Partial<WorkDaySchedule>,
): WorkDaySchedule[] {
  return days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day));
}

export function WorkWeekForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  const [days, setDays] = useState(initialSnapshot.workDays);
  const [state, formAction, pending] = useActionState(updateWorkWeekAction, initial);
  const timeOptions = buildWorkTimeOptions();

  useEffect(() => {
    setDays(initialSnapshot.workDays);
  }, [initialSnapshot]);

  const onBusinessPatch = useCallback((patch: Partial<TenantBusinessSnapshot>) => {
    if (patch.workDays) setDays(patch.workDays);
  }, []);

  useServerActionSnapshot(state.success, state.businessPatch, onBusinessPatch);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, formAction);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.settingsForm}>
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

      <span className={styles.fieldLabel}>Hours of operation</span>
      <p className={styles.fieldHint}>
        Set each day on its own. A closed day is left unchecked and is not given the same hours as
        the other days.
      </p>
      <ul className={styles.hoursDayList}>
        {days.map((day) => (
          <li key={day.weekday} className={styles.hoursDayRow}>
            <label className={styles.hoursDayToggle}>
              <input
                type="checkbox"
                name={`work_day_${day.weekday}`}
                checked={day.enabled}
                disabled={readOnly}
                onChange={(event) =>
                  setDays((current) =>
                    updateDay(current, day.weekday, { enabled: event.target.checked }),
                  )
                }
              />
              <span>{WORK_WEEK_DAY_LABEL[day.weekday]}</span>
            </label>
            <select
              name={`work_day_${day.weekday}_start`}
              className={styles.fieldSelect}
              value={day.start}
              disabled={readOnly || !day.enabled}
              aria-label={`${WORK_WEEK_DAY_LABEL[day.weekday]} start`}
              onChange={(event) =>
                setDays((current) => updateDay(current, day.weekday, { start: event.target.value }))
              }
            >
              {timeOptions.map((option) => (
                <option key={`${day.weekday}-start-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className={styles.hoursDayDash} aria-hidden>
              –
            </span>
            <select
              name={`work_day_${day.weekday}_end`}
              className={styles.fieldSelect}
              value={day.end}
              disabled={readOnly || !day.enabled}
              aria-label={`${WORK_WEEK_DAY_LABEL[day.weekday]} end`}
              onChange={(event) =>
                setDays((current) => updateDay(current, day.weekday, { end: event.target.value }))
              }
            >
              {timeOptions.map((option) => (
                <option key={`${day.weekday}-end-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {!readOnly ? <SettingsSaveButton pending={pending} saved={Boolean(state.success)} /> : null}
    </form>
  );
}
