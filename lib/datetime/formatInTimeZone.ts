/** Matches default on `tenants.timezone` in migrations. */
export const DEFAULT_TENANT_TIMEZONE = 'America/New_York';

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

export function formatDateTimeInTimeZone(
  iso: string,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: safeTimeZone(timeZone),
  }).format(d);
}

/** e.g. Tuesday, May 12 at 9:00 AM */
export function formatNextAppointmentWhen(
  startsAt: string,
  timeZone: string | null | undefined,
): string {
  const date = formatDateTimeInTimeZone(startsAt, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const time = formatDateTimeInTimeZone(startsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} at ${time}`;
}

function calendarDayKey(iso: string, timeZone: string | null | undefined): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Start through end, in the workspace timezone.
 * Same calendar day: Tuesday, June 8 at 9:00 AM – 11:00 AM.
 * Overnight: Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM.
 */
export function formatVisitWindow(
  startsAt: string,
  endsAt: string,
  timeZone: string | null | undefined,
): string {
  const start = formatNextAppointmentWhen(startsAt, timeZone);
  if (Number.isNaN(new Date(endsAt).getTime())) return start;
  const startDay = calendarDayKey(startsAt, timeZone);
  const endDay = calendarDayKey(endsAt, timeZone);
  const end =
    startDay && endDay && startDay !== endDay
      ? formatNextAppointmentWhen(endsAt, timeZone)
      : formatDateTimeInTimeZone(endsAt, timeZone, {
          hour: 'numeric',
          minute: '2-digit',
        });
  if (end === '—') return start;
  return `${start} – ${end}`;
}

/** e.g. Tue, May 12, 2025 */
export function formatUpcomingVisitDate(
  startsAt: string,
  timeZone: string | null | undefined,
): string {
  return formatDateTimeInTimeZone(startsAt, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. 9:00 AM */
export function formatVisitTime(startsAt: string, timeZone: string | null | undefined): string {
  return formatDateTimeInTimeZone(startsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** e.g. Tuesday, May 12, 2025 · 9:00 AM – 11:00 AM */
export function formatVisitWhenRange(
  startsAt: string,
  endsAt: string,
  timeZone: string | null | undefined,
): string {
  const date = formatDateTimeInTimeZone(startsAt, timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const t0 = formatVisitTime(startsAt, timeZone);
  const t1 = formatVisitTime(endsAt, timeZone);
  return `${date} · ${t0} – ${t1}`;
}

/** e.g. May 12, 2026, 9:00 AM – 11:00 AM (visits list) */
export function formatVisitWhenCompact(
  startsAt: string,
  endsAt: string,
  timeZone: string | null | undefined,
): string {
  const startLabel = formatDateTimeInTimeZone(startsAt, timeZone, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const endTime = formatVisitTime(endsAt, timeZone);
  return `${startLabel} – ${endTime}`;
}

export function formatVisitDuration(startsAt: string, endsAt: string): string {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const hours = ms / 3_600_000;
  if (hours < 1) {
    const mins = Math.round(ms / 60_000);
    return `${mins} min`;
  }
  const rounded = Math.round(hours * 10) / 10;
  const label = rounded === 1 ? 'hour' : 'hours';
  return Number.isInteger(rounded) ? `${rounded} ${label}` : `${rounded} hours`;
}

export function formatUpcomingVisitTimeLine(
  startsAt: string,
  endsAt: string,
  timeZone: string | null | undefined,
): string {
  const time = formatVisitTime(startsAt, timeZone);
  const duration = formatVisitDuration(startsAt, endsAt);
  return duration ? `${time} · ${duration}` : time;
}
