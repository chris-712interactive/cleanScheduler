import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';
import { DEFAULT_WORK_WEEK_DAYS } from '@/lib/tenant/tenantBusinessSettings';

const WEEKDAY_SHORT_TO_KEY: Record<string, WorkWeekDayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

function safeTimeZone(timeZone: string | null | undefined): string {
  const tz = timeZone?.trim();
  if (!tz) return DEFAULT_TENANT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TENANT_TIMEZONE;
  }
}

function parseHm(raw: string): { hour: number; minute: number } {
  const match = raw.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function calendarPartsInTimeZone(at: Date, timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = read('weekday').slice(0, 3);
  const dayKey = WEEKDAY_SHORT_TO_KEY[weekday] ?? 'mon';

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    dayKey,
  };
}

/** Resolve a wall-clock instant in an IANA timezone to UTC ISO. */
export function localWallClockInTimeZoneToUtcIso(
  timeZone: string,
  parts: { year: number; month: number; day: number; hour: number; minute: number },
): string | null {
  const tz = safeTimeZone(timeZone);
  const targetDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });

  const anchor = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  for (let ms = anchor - 24 * 3_600_000; ms < anchor + 24 * 3_600_000; ms += 60_000) {
    const d = new Date(ms);
    const formatted = fmt.formatToParts(d);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      formatted.find((part) => part.type === type)?.value ?? '';
    const dateKey = `${read('year')}-${read('month')}-${read('day')}`;
    const hour = Number(read('hour'));
    const minute = Number(read('minute'));
    if (
      dateKey === targetDate &&
      hour === parts.hour &&
      minute === parts.minute &&
      Number.isFinite(hour) &&
      Number.isFinite(minute)
    ) {
      return d.toISOString();
    }
  }

  return null;
}

export function computeNextWorkDayVisitWindow(input: {
  timezone: string;
  workWeekDays?: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  now?: Date;
  /** Skip this many calendar days before searching for the next work day (stagger multi-line scheduling). */
  startAfterDays?: number;
  /** When set, visit ends at start + this many hours instead of the full work-day window. */
  durationHours?: number;
}): { startsAt: string; endsAt: string } {
  const timeZone = safeTimeZone(input.timezone);
  const workWeekDays =
    input.workWeekDays && input.workWeekDays.length > 0
      ? input.workWeekDays
      : [...DEFAULT_WORK_WEEK_DAYS];
  const startHm = parseHm(input.workDayStart);
  const endHm = parseHm(input.workDayEnd);
  const now = input.now ?? new Date();
  const startAfterDays = Math.max(0, input.startAfterDays ?? 0);

  for (let offset = startAfterDays; offset < startAfterDays + 14; offset += 1) {
    const probe = new Date(now.getTime() + offset * 24 * 3_600_000);
    const cal = calendarPartsInTimeZone(probe, timeZone);
    if (!workWeekDays.includes(cal.dayKey)) continue;

    const startsAt =
      localWallClockInTimeZoneToUtcIso(timeZone, {
        year: cal.year,
        month: cal.month,
        day: cal.day,
        hour: startHm.hour,
        minute: startHm.minute,
      }) ?? null;

    if (!startsAt) continue;

    let endsAt =
      localWallClockInTimeZoneToUtcIso(timeZone, {
        year: cal.year,
        month: cal.month,
        day: cal.day,
        hour: endHm.hour,
        minute: endHm.minute,
      }) ?? null;

    if (!endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      endsAt = new Date(new Date(startsAt).getTime() + 2 * 3_600_000).toISOString();
    }

    const window =
      input.durationHours != null && input.durationHours > 0
        ? applyDurationToVisitWindow({ startsAt, endsAt }, input.durationHours)
        : { startsAt, endsAt };

    if (new Date(window.startsAt).getTime() > now.getTime()) {
      return window;
    }
  }

  const fallbackStart = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const fallbackWindow = {
    startsAt: fallbackStart,
    endsAt: new Date(new Date(fallbackStart).getTime() + 2 * 3_600_000).toISOString(),
  };
  if (input.durationHours != null && input.durationHours > 0) {
    return applyDurationToVisitWindow(fallbackWindow, input.durationHours);
  }
  return fallbackWindow;
}
