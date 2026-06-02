import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';
import {
  DEFAULT_WORK_WEEK_DAYS,
  normalizeWorkTimeValue,
  WORK_WEEK_DAY_KEYS,
  WORK_WEEK_DAY_LABEL,
} from '@/lib/tenant/tenantBusinessSettings';

export type MemberDayWindow = {
  weekday: WorkWeekDayKey;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

export type MemberScheduleProfile = {
  userId: string;
  useTenantDefault: boolean;
  days: MemberDayWindow[];
};

export type EffectiveMemberSchedule = {
  userId: string;
  timezone: string;
  dayWindows: Partial<Record<WorkWeekDayKey, { startsAt: string; endsAt: string }>>;
};

export function createDefaultMemberDayWindows(input?: {
  enabledWeekdays?: WorkWeekDayKey[];
  startsAt?: string;
  endsAt?: string;
}): MemberDayWindow[] {
  const enabled = new Set(input?.enabledWeekdays ?? DEFAULT_WORK_WEEK_DAYS);
  const startsAt = normalizeWorkTimeValue(input?.startsAt ?? '08:00');
  const endsAt = normalizeWorkTimeValue(input?.endsAt ?? '17:00');

  return WORK_WEEK_DAY_KEYS.map((weekday) => ({
    weekday,
    enabled: enabled.has(weekday),
    startsAt,
    endsAt,
  }));
}

export function memberDayWindowsFromDbRows(
  rows: Array<{ weekday: string; starts_at: string; ends_at: string }>,
  fallback?: { startsAt: string; endsAt: string },
): MemberDayWindow[] {
  const byWeekday = new Map(
    rows.map((row) => [
      row.weekday as WorkWeekDayKey,
      {
        startsAt: normalizeWorkTimeValue(row.starts_at),
        endsAt: normalizeWorkTimeValue(row.ends_at),
      },
    ]),
  );

  const defaultStart = fallback?.startsAt ?? '08:00';
  const defaultEnd = fallback?.endsAt ?? '17:00';

  return WORK_WEEK_DAY_KEYS.map((weekday) => {
    const window = byWeekday.get(weekday);
    return {
      weekday,
      enabled: Boolean(window),
      startsAt: window?.startsAt ?? defaultStart,
      endsAt: window?.endsAt ?? defaultEnd,
    };
  });
}

export function effectiveDayWindowsFromMemberDays(
  days: MemberDayWindow[],
): EffectiveMemberSchedule['dayWindows'] {
  const dayWindows: EffectiveMemberSchedule['dayWindows'] = {};
  for (const day of days) {
    if (!day.enabled) continue;
    dayWindows[day.weekday] = { startsAt: day.startsAt, endsAt: day.endsAt };
  }
  return dayWindows;
}

export function parseMemberAvailabilityDaysFromForm(formData: FormData): MemberDayWindow[] {
  return WORK_WEEK_DAY_KEYS.map((weekday) => ({
    weekday,
    enabled: formData.get(`avail_${weekday}_enabled`) === 'on',
    startsAt: normalizeWorkTimeValue(String(formData.get(`avail_${weekday}_start`) ?? '08:00')),
    endsAt: normalizeWorkTimeValue(String(formData.get(`avail_${weekday}_end`) ?? '17:00')),
  }));
}

export function validateMemberDayWindows(days: MemberDayWindow[]): string | null {
  const enabled = days.filter((day) => day.enabled);
  if (enabled.length === 0) {
    return 'Enable at least one work day with hours.';
  }

  for (const day of enabled) {
    if (day.startsAt >= day.endsAt) {
      return `${WORK_WEEK_DAY_LABEL[day.weekday]}: end time must be after start time.`;
    }
  }

  return null;
}

export function summarizeMemberDayWindows(days: MemberDayWindow[]): string {
  const enabled = days.filter((day) => day.enabled);
  if (enabled.length === 0) return 'No days enabled';

  const groups = new Map<string, WorkWeekDayKey[]>();
  for (const day of enabled) {
    const key = `${day.startsAt}-${day.endsAt}`;
    const list = groups.get(key) ?? [];
    list.push(day.weekday);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([window, weekdays]) => {
      const labels = weekdays.map((d) => WORK_WEEK_DAY_LABEL[d]).join(', ');
      const [start, end] = window.split('-');
      return `${labels} ${start}–${end}`;
    })
    .join(' · ');
}
