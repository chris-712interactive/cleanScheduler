'use client';

import { useActionState, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import type { MemberDayWindow, MemberScheduleProfile } from '@/lib/schedule/memberScheduleProfile';
import type { TenantBusinessSnapshot } from '@/lib/tenant/tenantBusinessSettings';
import {
  createDefaultMemberDayWindows,
  summarizeMemberDayWindows,
} from '@/lib/tenant/memberAvailabilityDays';
import {
  WORK_WEEK_DAY_LABEL,
  buildWorkTimeOptions,
  openWorkDayHours,
  summarizeWorkDaySchedule,
} from '@/lib/tenant/tenantBusinessSettings';
import {
  updateMemberAvailabilityAction,
  type MemberAvailabilityActionState,
} from './employeeAvailabilityActions';
import styles from './employeeEdit.module.scss';
import sectionStyles from '../customers/scheduling-fields.module.scss';

const initial: MemberAvailabilityActionState = {};

function updateDay(
  days: MemberDayWindow[],
  weekday: MemberDayWindow['weekday'],
  patch: Partial<MemberDayWindow>,
): MemberDayWindow[] {
  return days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day));
}

export function EmployeeAvailabilityForm({
  tenantSlug,
  targetUserId,
  profile: initialProfile,
  tenantDefaults,
  layout = 'plain',
}: {
  tenantSlug: string;
  targetUserId: string;
  profile: MemberScheduleProfile;
  tenantDefaults: TenantBusinessSnapshot;
  /** Disclosure keeps the hour editor collapsed until opened. */
  layout?: 'plain' | 'disclosure';
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [hoursOpen, setHoursOpen] = useState(!initialProfile.useTenantDefault);
  const [state, formAction, pending] = useActionState(updateMemberAvailabilityAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  const timeOptions = buildWorkTimeOptions();

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  const onProfilePatch = useCallback((patch: Partial<MemberScheduleProfile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  useServerActionSnapshot(state.success, state.profilePatch, onProfilePatch);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, formAction);
  };

  const tenantSummary = summarizeWorkDaySchedule(tenantDefaults.workDays);
  const hoursHint = profile.useTenantDefault
    ? `Company hours · ${tenantSummary}`
    : summarizeMemberDayWindows(profile.days);

  const fields = (
    <>
      <label
        className={layout === 'disclosure' ? sectionStyles.check : styles.checkboxRow}
        data-selected={layout === 'disclosure' && profile.useTenantDefault ? true : undefined}
      >
        <input
          type="checkbox"
          name="use_tenant_default"
          checked={profile.useTenantDefault}
          onChange={(e) => {
            const useTenantDefault = e.target.checked;
            onProfilePatch({
              useTenantDefault,
              days: useTenantDefault
                ? createDefaultMemberDayWindows({
                    enabledWeekdays: tenantDefaults.workWeekDays,
                    startsAt: tenantDefaults.workDayStart,
                    endsAt: tenantDefaults.workDayEnd,
                    dayHours: openWorkDayHours(tenantDefaults.workDays),
                  })
                : profile.days,
            });
          }}
        />
        <span>Use business default hours</span>
      </label>

      {profile.useTenantDefault ? (
        <p className={styles.hint}>Inherits {tenantSummary}</p>
      ) : (
        <>
          <p className={styles.hint}>
            Set hours per day — e.g. shorter shifts on Fridays or no Saturdays.
          </p>
          <ul className={styles.availabilityDayList}>
            {profile.days.map((day) => (
              <li key={day.weekday} className={styles.availabilityDayRow}>
                <label className={styles.availabilityDayToggle}>
                  <input
                    type="checkbox"
                    name={`avail_${day.weekday}_enabled`}
                    checked={day.enabled}
                    onChange={(e) =>
                      onProfilePatch({
                        days: updateDay(profile.days, day.weekday, { enabled: e.target.checked }),
                      })
                    }
                  />
                  <span className={styles.availabilityDayLabel}>
                    {WORK_WEEK_DAY_LABEL[day.weekday]}
                  </span>
                </label>
                <select
                  name={`avail_${day.weekday}_start`}
                  className={styles.select}
                  value={day.startsAt}
                  disabled={!day.enabled}
                  aria-label={`${WORK_WEEK_DAY_LABEL[day.weekday]} start`}
                  onChange={(e) =>
                    onProfilePatch({
                      days: updateDay(profile.days, day.weekday, { startsAt: e.target.value }),
                    })
                  }
                >
                  {timeOptions.map((option) => (
                    <option key={`${day.weekday}-start-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={styles.availabilityDayDash} aria-hidden>
                  –
                </span>
                <select
                  name={`avail_${day.weekday}_end`}
                  className={styles.select}
                  value={day.endsAt}
                  disabled={!day.enabled}
                  aria-label={`${WORK_WEEK_DAY_LABEL[day.weekday]} end`}
                  onChange={(e) =>
                    onProfilePatch({
                      days: updateDay(profile.days, day.weekday, { endsAt: e.target.value }),
                    })
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
          <p className={styles.hint}>{summarizeMemberDayWindows(profile.days)}</p>
        </>
      )}

      <div className={styles.saveRow}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save hours'}
        </Button>
      </div>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className={styles.availabilityForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="target_user_id" value={targetUserId} />
      {layout === 'disclosure' ? (
        <details
          className={sectionStyles.section}
          open={hoursOpen}
          onToggle={(event) => setHoursOpen(event.currentTarget.open)}
        >
          <summary className={sectionStyles.sectionSummary}>
            <span className={sectionStyles.sectionTitle}>Hours</span>
            <span className={sectionStyles.sectionHint}>{hoursHint}</span>
          </summary>
          <div className={sectionStyles.sectionBody}>{fields}</div>
        </details>
      ) : (
        fields
      )}
    </form>
  );
}
