import { formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import {
  calendarDateKeyInTimeZone,
  visitTouchesCalendarDayInTimeZone,
} from '@/lib/datetime/tenantCalendarDay';
import { shiftDateKey, utcWeekDayKeys } from '@/lib/tenant/scheduleDateRange';

export type EmployeeTimeOffStatus = 'pending' | 'approved';

export type EmployeeScheduleVisit = {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  customerName: string;
};

export type EmployeeScheduleTimeOff = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: EmployeeTimeOffStatus;
  note: string;
};

export type EmployeeScheduleBlock =
  | ({ kind: 'visit'; timeLabel: string } & EmployeeScheduleVisit)
  | ({ kind: 'time_off'; timeLabel: string } & EmployeeScheduleTimeOff);

export type EmployeeScheduleDay = {
  dateKey: string;
  label: string;
  isToday: boolean;
  blocks: EmployeeScheduleBlock[];
};

export function employeeWeekDateKeys(anchorDateKey: string): string[] {
  return utcWeekDayKeys(anchorDateKey);
}

export function formatEmployeeDayHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** Clock label for a time-off window on one calendar day. */
export function timeOffLabelForDay(
  timeOff: { startsAt: string; endsAt: string },
  dateKey: string,
  timeZone: string,
): string {
  const startKey = calendarDateKeyInTimeZone(timeZone, new Date(timeOff.startsAt));
  const endKey = calendarDateKeyInTimeZone(timeZone, new Date(timeOff.endsAt));
  if (startKey < dateKey && endKey > dateKey) return 'All day';
  if (startKey === dateKey && endKey === dateKey) {
    return `${formatVisitTime(timeOff.startsAt, timeZone)} – ${formatVisitTime(timeOff.endsAt, timeZone)}`;
  }
  if (startKey === dateKey) return `From ${formatVisitTime(timeOff.startsAt, timeZone)}`;
  if (endKey === dateKey) return `Until ${formatVisitTime(timeOff.endsAt, timeZone)}`;
  return 'All day';
}

export function buildEmployeeWeekDays(params: {
  weekDateKeys: string[];
  todayKey: string;
  timeZone: string;
  visits: EmployeeScheduleVisit[];
  timeOff: EmployeeScheduleTimeOff[];
}): EmployeeScheduleDay[] {
  return params.weekDateKeys.map((dateKey) => {
    const visits = params.visits
      .filter((visit) =>
        visitTouchesCalendarDayInTimeZone(
          { starts_at: visit.startsAt, ends_at: visit.endsAt },
          dateKey,
          params.timeZone,
        ),
      )
      .map((visit): EmployeeScheduleBlock => ({
        ...visit,
        kind: 'visit',
        timeLabel: `${formatVisitTime(visit.startsAt, params.timeZone)} – ${formatVisitTime(visit.endsAt, params.timeZone)}`,
      }));

    const timeOff = params.timeOff
      .filter((off) =>
        visitTouchesCalendarDayInTimeZone(
          { starts_at: off.startsAt, ends_at: off.endsAt },
          dateKey,
          params.timeZone,
        ),
      )
      .map((off): EmployeeScheduleBlock => ({
        ...off,
        kind: 'time_off',
        timeLabel: timeOffLabelForDay(off, dateKey, params.timeZone),
      }));

    const blocks = [...visits, ...timeOff].sort((a, b) => {
      const byStart = a.startsAt.localeCompare(b.startsAt);
      if (byStart !== 0) return byStart;
      if (a.kind === b.kind) return a.id.localeCompare(b.id);
      return a.kind === 'visit' ? -1 : 1;
    });

    return {
      dateKey,
      label: formatEmployeeDayHeading(dateKey),
      isToday: dateKey === params.todayKey,
      blocks,
    };
  });
}

/** Next time off that does not fall on the visible week, if any. */
export function nextTimeOffOutsideWeek(
  timeOff: EmployeeScheduleTimeOff[],
  weekDateKeys: string[],
  timeZone: string,
): EmployeeScheduleTimeOff | null {
  const outside = timeOff
    .filter(
      (off) =>
        !weekDateKeys.some((dateKey) =>
          visitTouchesCalendarDayInTimeZone(
            { starts_at: off.startsAt, ends_at: off.endsAt },
            dateKey,
            timeZone,
          ),
        ),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return outside[0] ?? null;
}

export function employeeWeekShift(anchorDateKey: string, deltaWeeks: number): string {
  return shiftDateKey(utcWeekDayKeys(anchorDateKey)[0] ?? anchorDateKey, deltaWeeks * 7);
}
