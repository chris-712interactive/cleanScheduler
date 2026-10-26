export const MIN_CONFIRM_WINDOW_MINUTES = 30;
export const MAX_CONFIRM_WINDOW_MINUTES = 24 * 60;
export const DEFAULT_CONFIRM_WINDOW_MINUTES = 180;
export const CONFIRM_LEAD_MINUTES = 30;

export function clampConfirmWindowMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_CONFIRM_WINDOW_MINUTES;
  return Math.min(
    MAX_CONFIRM_WINDOW_MINUTES,
    Math.max(MIN_CONFIRM_WINDOW_MINUTES, Math.round(minutes)),
  );
}

/** Hold ends at the confirm window, or 30 minutes before the slot, whichever is sooner. */
export function confirmDeadline(now: Date, slotStartsAt: Date, windowMinutes: number): Date {
  const windowMs = clampConfirmWindowMinutes(windowMinutes) * 60_000;
  const byWindow = now.getTime() + windowMs;
  const latest = slotStartsAt.getTime() - CONFIRM_LEAD_MINUTES * 60_000;
  return new Date(Math.min(byWindow, latest));
}

export function slotIsOfferable(
  now: Date,
  slotStartsAt: Date,
  windowMinutes: number,
  held: boolean,
): boolean {
  if (held) return false;
  if (slotStartsAt.getTime() <= now.getTime()) return false;
  return confirmDeadline(now, slotStartsAt, windowMinutes).getTime() > now.getTime();
}

export interface OfferableSlot {
  id: string;
  startsAt: string;
  held: boolean;
}

/** Earliest future slot that can still be confirmed. */
export function pickEarliestSlot<T extends OfferableSlot>(
  slots: readonly T[],
  now: Date,
  windowMinutes: number,
): T | null {
  const open = slots
    .filter((slot) => slotIsOfferable(now, new Date(slot.startsAt), windowMinutes, slot.held))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return open[0] ?? null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function wallClockParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour');
  const minute = read('minute');
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) return null;
  return { year, month, day, hour, minute };
}

/** Wall-clock date and time in a tenant timezone, as a UTC instant. */
export function zonedLocalToUtcIso(date: string, time: string, timeZone: string): string | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = wallClockParts(new Date(utc), timeZone);
      if (!parts) return null;
      const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
      const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
      const delta = desired - asUtc;
      if (delta === 0) break;
      utc += delta;
    }
  } catch {
    return null;
  }

  const resolved = new Date(utc);
  if (Number.isNaN(resolved.getTime())) return null;
  const check = wallClockParts(resolved, timeZone);
  if (!check || check.year !== year || check.month !== month || check.day !== day) return null;
  if (check.hour !== hour || check.minute !== minute) return null;
  return resolved.toISOString();
}

export function localDateAndHour(
  instant: Date,
  timeZone: string,
): { date: string; hour: number } | null {
  const parts = wallClockParts(instant, timeZone);
  if (!parts) return null;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return { date: `${parts.year}-${month}-${day}`, hour: parts.hour };
}

/** Morning-of reminder: slot is later today, and local time is 7:00 or after. */
export function shouldSendMorningReminder(params: {
  now: Date;
  slotStartsAt: Date;
  timeZone: string;
}): boolean {
  const nowLocal = localDateAndHour(params.now, params.timeZone);
  const slotLocal = localDateAndHour(params.slotStartsAt, params.timeZone);
  if (!nowLocal || !slotLocal) return false;
  if (nowLocal.hour < 7) return false;
  if (nowLocal.date !== slotLocal.date) return false;
  return params.slotStartsAt.getTime() > params.now.getTime();
}
