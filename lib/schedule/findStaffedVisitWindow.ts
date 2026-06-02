import type { SupabaseClient } from '@supabase/supabase-js';
import { pickAutoAssignEmployee } from '@/lib/schedule/employeeAvailability';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';
import { DEFAULT_WORK_WEEK_DAYS } from '@/lib/tenant/tenantBusinessSettings';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

const WEEKDAY_SHORT_TO_KEY: Record<string, WorkWeekDayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

function safeTimeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return 'America/New_York';
  }
}

function parseHm(raw: string): { hour: number; minute: number } {
  const match = raw.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
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
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    dayKey: WEEKDAY_SHORT_TO_KEY[weekday] ?? 'mon',
  };
}

function buildVisitWindowAtLocalStart(input: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  startHour: number;
  startMinute: number;
  durationHours: number;
}): { startsAt: string; endsAt: string } | null {
  const startsAt =
    localWallClockInTimeZoneToUtcIso(input.timezone, {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.startHour,
      minute: input.startMinute,
    }) ?? null;

  if (!startsAt) return null;

  return applyDurationToVisitWindow({ startsAt, endsAt: startsAt }, input.durationHours);
}

export type FindStaffedVisitWindowInput = {
  tenantId: string;
  timezone: string;
  workWeekDays?: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  durationHours: number;
  now?: Date;
  /** Skip this many calendar days before searching. */
  startAfterDays?: number;
  /** Calendar days to scan (includes non-work days). Default 28. */
  searchHorizonDays?: number;
  /** Step between candidate start times within a work day. Default 15 minutes. */
  slotStepMinutes?: number;
  /** Do not return slots starting before this instant (defaults to `now`). */
  searchNotBefore?: Date;
};

export type StaffedVisitWindow = {
  startsAt: string;
  endsAt: string;
  assigneeUserId: string;
};

/**
 * Finds the earliest visit window where tenant business hours and at least one
 * field employee's availability overlap (work window, no time off, no visit conflict).
 */
export async function findStaffedVisitWindow(
  admin: Admin,
  input: FindStaffedVisitWindowInput,
): Promise<StaffedVisitWindow | null> {
  const timeZone = safeTimeZone(input.timezone);
  const workWeekDays =
    input.workWeekDays && input.workWeekDays.length > 0
      ? input.workWeekDays
      : [...DEFAULT_WORK_WEEK_DAYS];
  const workStart = parseHm(input.workDayStart);
  const workEnd = parseHm(input.workDayEnd);
  const workStartMin = minutesSinceMidnight(workStart.hour, workStart.minute);
  const workEndMin = minutesSinceMidnight(workEnd.hour, workEnd.minute);
  const durationMin = Math.round(Math.max(0.25, input.durationHours) * 60);
  const slotStepMinutes = Math.max(15, input.slotStepMinutes ?? 15);
  const now = input.now ?? new Date();
  const notBefore = input.searchNotBefore ?? now;
  const startAfterDays = Math.max(0, input.startAfterDays ?? 0);
  const searchHorizonDays = Math.max(7, input.searchHorizonDays ?? 28);

  if (durationMin > workEndMin - workStartMin) {
    return null;
  }

  for (let offset = startAfterDays; offset < startAfterDays + searchHorizonDays; offset += 1) {
    const probe = new Date(now.getTime() + offset * 24 * 3_600_000);
    const cal = calendarPartsInTimeZone(probe, timeZone);
    if (!workWeekDays.includes(cal.dayKey)) continue;

    for (
      let startMin = workStartMin;
      startMin + durationMin <= workEndMin;
      startMin += slotStepMinutes
    ) {
      const startHour = Math.floor(startMin / 60);
      const startMinute = startMin % 60;
      const window = buildVisitWindowAtLocalStart({
        timezone: timeZone,
        year: cal.year,
        month: cal.month,
        day: cal.day,
        startHour,
        startMinute,
        durationHours: input.durationHours,
      });

      if (!window || new Date(window.startsAt).getTime() <= notBefore.getTime()) {
        continue;
      }

      const assigneeUserId = await pickAutoAssignEmployee(admin, {
        tenantId: input.tenantId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      });

      if (assigneeUserId) {
        return {
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          assigneeUserId,
        };
      }
    }
  }

  return null;
}
