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

/** Instant at 00:00 on the first day of the calendar month containing `at` (tenant timezone). */
export function startOfCalendarMonthInTimeZone(
  timeZone: string | null | undefined,
  at: Date = new Date(),
): Date {
  const tz = safeTimeZone(timeZone);
  const monthKey = calendarDateKeyInTimeZone(tz, at).slice(0, 7);
  const [yRaw, mRaw] = monthKey.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return at;
  }
  const target = `${y}-${String(m).padStart(2, '0')}-01`;
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  });
  const startProbe = Date.UTC(y, m - 1, 1, 0, 0, 0) - 24 * 3600_000;
  for (let ms = startProbe; ms < startProbe + 72 * 3600_000; ms += 15 * 60_000) {
    const d = new Date(ms);
    if (calendarDateKeyInTimeZone(tz, d) !== target) continue;
    if (Number(hourFmt.format(d)) === 0) return d;
  }
  return new Date(Date.UTC(y, m - 1, 1, 8, 0, 0));
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
