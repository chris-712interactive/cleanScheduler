/** Tenant-timezone timeline layout for schedule day view. */

import { formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import {
  calendarDateKeyInTimeZone,
  visitTouchesCalendarDayInTimeZone,
} from '@/lib/datetime/tenantCalendarDay';

export interface TimelineWindow {
  /** Inclusive hour (0–23). */
  startHour: number;
  /** Exclusive hour (1–24). */
  endHour: number;
}

/** Fallback when the selected day has no visits. */
export const DEFAULT_TIMELINE_WINDOW: TimelineWindow = {
  startHour: 6,
  endHour: 21,
};

const MIN_TIMELINE_SPAN_HOURS = 8;
const TIMELINE_PAD_HOURS = 1;

export function calendarDateKeyNow(timeZone: string): string {
  return calendarDateKeyInTimeZone(timeZone, new Date());
}

function calendarPartsInTimeZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  let hour = Number(get('hour'));
  if (get('hour') === '24') hour = 0;

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

function fractionalHourInTimeZone(iso: string, timeZone: string): number {
  const parts = calendarPartsInTimeZone(iso, timeZone);
  return parts.hour + parts.minute / 60 + parts.second / 3600;
}

function slotInstantMs(dateKey: string, hour: number, timeZone: string): number {
  const iso = parseTenantDatetimeLocalToIso(
    `${dateKey}T${String(hour).padStart(2, '0')}:00`,
    timeZone,
  );
  return iso ? new Date(iso).getTime() : Number.NaN;
}

function visitHourSpanOnDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
  timeZone: string,
): { startHour: number; endHourExclusive: number } | null {
  if (!visitTouchesCalendarDayInTimeZone(visit, dateKey, timeZone)) return null;

  const startKey = calendarDateKeyInTimeZone(timeZone, new Date(visit.starts_at));
  const endKey = calendarDateKeyInTimeZone(timeZone, new Date(visit.ends_at));

  const startHour = startKey === dateKey ? fractionalHourInTimeZone(visit.starts_at, timeZone) : 0;
  const endHour = endKey === dateKey ? fractionalHourInTimeZone(visit.ends_at, timeZone) : 24;
  const endHourExclusive = Math.min(24, Math.max(startHour + 0.25, Math.ceil(endHour)));

  if (endHourExclusive <= startHour) return null;

  return { startHour, endHourExclusive };
}

/** Expand the visible timeline to fit visits on this day (with padding). */
export function resolveTimelineWindow(
  dateKey: string,
  visits: Array<{ starts_at: string; ends_at: string }>,
  timeZone: string,
): TimelineWindow {
  const spans = visits
    .map((visit) => visitHourSpanOnDay(visit, dateKey, timeZone))
    .filter((span): span is NonNullable<typeof span> => span != null);

  if (spans.length === 0) {
    return DEFAULT_TIMELINE_WINDOW;
  }

  let startHour = Math.floor(Math.min(...spans.map((s) => s.startHour)));
  let endHour = Math.ceil(Math.max(...spans.map((s) => s.endHourExclusive)));

  startHour = Math.max(0, startHour - TIMELINE_PAD_HOURS);
  endHour = Math.min(24, endHour + TIMELINE_PAD_HOURS);

  if (endHour - startHour < MIN_TIMELINE_SPAN_HOURS) {
    const mid = (startHour + endHour) / 2;
    startHour = Math.max(0, Math.floor(mid - MIN_TIMELINE_SPAN_HOURS / 2));
    endHour = Math.min(24, startHour + MIN_TIMELINE_SPAN_HOURS);
  }

  if (endHour <= startHour) {
    return DEFAULT_TIMELINE_WINDOW;
  }

  return { startHour, endHour };
}

export function layoutVisitOnCalendarDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
  timeZone: string,
  window: TimelineWindow = DEFAULT_TIMELINE_WINDOW,
): { topPct: number; heightPct: number; visible: boolean } {
  const slotStartMs = slotInstantMs(dateKey, window.startHour, timeZone);
  const slotEndMs = slotInstantMs(dateKey, window.endHour, timeZone);
  const totalMs = slotEndMs - slotStartMs;
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return { topPct: 0, heightPct: 0, visible: false };
  }

  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  const clampedStart = Math.max(vs, slotStartMs);
  const clampedEnd = Math.min(ve, slotEndMs);
  if (clampedEnd <= clampedStart) return { topPct: 0, heightPct: 0, visible: false };

  const topPct = ((clampedStart - slotStartMs) / totalMs) * 100;
  const heightPct = Math.max(((clampedEnd - clampedStart) / totalMs) * 100, 2.2);
  return { topPct, heightPct, visible: true };
}

export function visitOverlapsCalendarDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
  timeZone: string,
): boolean {
  return visitTouchesCalendarDayInTimeZone(visit, dateKey, timeZone);
}

export function currentTimeLinePct(
  dateKey: string,
  timeZone: string,
  window: TimelineWindow = DEFAULT_TIMELINE_WINDOW,
): number | null {
  if (calendarDateKeyNow(timeZone) !== dateKey) return null;

  const slotStartMs = slotInstantMs(dateKey, window.startHour, timeZone);
  const slotEndMs = slotInstantMs(dateKey, window.endHour, timeZone);
  const t = Date.now();
  if (t < slotStartMs || t > slotEndMs) return null;

  const totalMs = slotEndMs - slotStartMs;
  return ((t - slotStartMs) / totalMs) * 100;
}

export type VisitColumnPlacement = {
  column: number;
  columnCount: number;
};

type ColumnVisit = { id: string; starts_at: string; ends_at: string };

/**
 * Place overlapping visits in side-by-side columns.
 * Visits that do not overlap keep a single column so the card stays narrow.
 */
export function layoutVisitColumns(visits: ColumnVisit[]): Map<string, VisitColumnPlacement> {
  const sorted = [...visits].sort((a, b) => {
    const byStart = a.starts_at.localeCompare(b.starts_at);
    if (byStart !== 0) return byStart;
    return a.ends_at.localeCompare(b.ends_at) || a.id.localeCompare(b.id);
  });

  type Placed = { id: string; start: number; end: number; column: number };
  const placed: Placed[] = [];
  const columnEnds: number[] = [];

  for (const visit of sorted) {
    const start = new Date(visit.starts_at).getTime();
    const end = new Date(visit.ends_at).getTime();
    let column = columnEnds.findIndex((busyUntil) => busyUntil <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    placed.push({ id: visit.id, start, end, column });
  }

  const result = new Map<string, VisitColumnPlacement>();
  const seen = new Set<string>();

  for (const item of placed) {
    if (seen.has(item.id)) continue;

    const cluster: Placed[] = [];
    const stack = [item];
    seen.add(item.id);

    while (stack.length > 0) {
      const current = stack.pop()!;
      cluster.push(current);
      for (const other of placed) {
        if (seen.has(other.id)) continue;
        const overlaps = current.start < other.end && other.start < current.end;
        if (!overlaps) continue;
        seen.add(other.id);
        stack.push(other);
      }
    }

    const columnCount = Math.max(...cluster.map((member) => member.column)) + 1;
    for (const member of cluster) {
      result.set(member.id, { column: member.column, columnCount });
    }
  }

  return result;
}

export function hourLabels(window: TimelineWindow = DEFAULT_TIMELINE_WINDOW): {
  label: string;
  hour: number;
}[] {
  const out: { label: string; hour: number }[] = [];
  for (let h = window.startHour; h < window.endHour; h++) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    out.push({ hour: h, label: `${hour12}:00 ${suffix}` });
  }
  return out;
}

export function formatVisitTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatVisitTime(startsAt, timeZone)} – ${formatVisitTime(endsAt, timeZone)}`;
}
