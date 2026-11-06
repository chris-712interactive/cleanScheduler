'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
import layoutStyles from './business-settings.module.scss';
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
  useFeedbackToast({ error: state.error, success: state.success, pending });
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
    <form onSubmit={handleSubmit} className={layoutStyles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <p className={layoutStyles.hint}>
        Check a day to open it. A closed day stays unchecked and keeps its own hours for the next
        time you open it.
      </p>
      <ul className={layoutStyles.weekGrid}>
        {days.map((day) => (
          <li key={day.weekday} className={layoutStyles.dayCard}>
            <label className={layoutStyles.dayToggle}>
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
            <div className={layoutStyles.dayTimes}>
              <select
                name={`work_day_${day.weekday}_start`}
                className={styles.fieldSelect}
                value={day.start}
                disabled={readOnly || !day.enabled}
                aria-label={`${WORK_WEEK_DAY_LABEL[day.weekday]} start`}
                onChange={(event) =>
                  setDays((current) =>
                    updateDay(current, day.weekday, { start: event.target.value }),
                  )
                }
              >
                {timeOptions.map((option) => (
                  <option key={`${day.weekday}-start-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className={layoutStyles.dayDash} aria-hidden>
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
            </div>
          </li>
        ))}
      </ul>

      {!readOnly ? <SettingsSaveButton pending={pending} saved={Boolean(state.success)} /> : null}
    </form>
  );
}
