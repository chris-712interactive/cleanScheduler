import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';

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

/** Calendar date (YYYY-MM-DD) for an instant in the tenant timezone. */
export function calendarDateKeyInTimeZone(
  timeZone: string | null | undefined,
  at: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** True when a visit overlaps a calendar day in the tenant timezone. */
export function visitTouchesCalendarDayInTimeZone(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
  timeZone: string | null | undefined,
): boolean {
  const tz = safeTimeZone(timeZone);
  const startKey = calendarDateKeyInTimeZone(tz, new Date(visit.starts_at));
  const endKey = calendarDateKeyInTimeZone(tz, new Date(visit.ends_at));
  if (startKey === dateKey || endKey === dateKey) return true;
  return startKey < dateKey && endKey > dateKey;
}
