'use client';

import { useActionState, useEffect, useState } from 'react';
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

const DAY_NAME: Record<WorkWeekDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const TIME_OPTIONS: Array<{
  value: '' | PreferredTimeWindow;
  title: string;
  hint: string;
}> = [
  { value: '', title: 'Any time', hint: 'Whenever the day allows' },
  { value: 'morning', title: 'Morning', hint: 'From about 8:00' },
  { value: 'afternoon', title: 'Afternoon', hint: 'From about noon' },
  { value: 'evening', title: 'Evening', hint: 'From about 4:00' },
];

function joinDays(days: WorkWeekDayKey[]): string {
  const names = days.map((day) => DAY_NAME[day]);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function scheduleSummary(days: WorkWeekDayKey[], timeOfDay: string): string {
  const ordered = WORK_WEEK_DAY_KEYS.filter((day) => days.includes(day));
  const timeLabel =
    timeOfDay === 'morning'
      ? 'mornings'
      : timeOfDay === 'afternoon'
        ? 'afternoons'
        : timeOfDay === 'evening'
          ? 'evenings'
          : '';

  if (ordered.length === 0 && !timeLabel) return 'Any open day works, at any time.';
  if (ordered.length === 0) return `We'll aim for ${timeLabel} on any open day.`;
  if (!timeLabel) return `We'll aim for ${joinDays(ordered)}.`;
  return `We'll aim for ${joinDays(ordered)} ${timeLabel}.`;
}

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
  const [timeOfDay, setTimeOfDay] = useState(timeWindow ?? '');
  const [days, setDays] = useState<WorkWeekDayKey[]>(weekdays);
  const savedDays = weekdays.join(',');
  const savedFromAction = state.weekdays?.join(',') ?? '';
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Saved. Your cleaner will aim for these days and times.',
    pending,
  });
  useEffect(() => {
    setTimeOfDay(timeWindow ?? '');
  }, [timeWindow]);
  useEffect(() => {
    setDays(savedDays ? (savedDays.split(',') as WorkWeekDayKey[]) : []);
  }, [savedDays]);
  useEffect(() => {
    if (!state.success) return;
    setTimeOfDay(state.timeWindow ?? '');
    setDays(savedFromAction ? (savedFromAction.split(',') as WorkWeekDayKey[]) : []);
  }, [state.success, state.timeWindow, savedFromAction]);

  function setDay(day: WorkWeekDayKey, checked: boolean) {
    setDays((current) =>
      checked
        ? WORK_WEEK_DAY_KEYS.filter((item) => item === day || current.includes(item))
        : current.filter((item) => item !== day),
    );
  }

  return (
    <form action={action} className={styles.scheduleForm}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="customer_id" value={customerId} />
      {showCompanyName ? <p className={styles.companyName}>{tenantName}</p> : null}

      <fieldset className={styles.block}>
        <legend className={styles.legend}>Days that work</legend>
        <div className={styles.dayList}>
          {WORK_WEEK_DAY_KEYS.map((day) => {
            const selected = days.includes(day);
            return (
              <label key={day} className={styles.day} data-selected={selected || undefined}>
                <input
                  type="checkbox"
                  name="preferred_weekday"
                  value={day}
                  checked={selected}
                  aria-label={DAY_NAME[day]}
                  onChange={(event) => setDay(day, event.target.checked)}
                />
                <span aria-hidden="true">{WORK_WEEK_DAY_LABEL[day]}</span>
              </label>
            );
          })}
        </div>
        <p className={styles.note}>Leave every day off if any open day is fine.</p>
      </fieldset>

      <fieldset className={styles.block}>
        <legend className={styles.legend}>Time of day</legend>
        <div className={styles.timeGrid}>
          {TIME_OPTIONS.map((option) => {
            const selected = timeOfDay === option.value;
            return (
              <label
                key={option.value || 'any'}
                className={styles.timeCard}
                data-selected={selected || undefined}
              >
                <input
                  type="radio"
                  name="preferred_time_window"
                  value={option.value}
                  checked={selected}
                  onChange={() => setTimeOfDay(option.value)}
                />
                <span className={styles.timeTitle}>{option.title}</span>
                <span className={styles.timeHint}>{option.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className={styles.summary}>{scheduleSummary(days, timeOfDay)}</p>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </form>
  );
}
