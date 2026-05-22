/** Local-day timeline layout (browser timezone) for tenant schedule day view. */

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

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayBounds(dateKey: string): { dayStart: Date; dayEnd: Date } {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  return {
    dayStart: new Date(y, mo - 1, da, 0, 0, 0, 0),
    dayEnd: new Date(y, mo - 1, da, 23, 59, 59, 999),
  };
}

function slotBounds(dateKey: string, window: TimelineWindow): { slotStart: Date; slotEnd: Date } {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  return {
    slotStart: new Date(y, mo - 1, da, window.startHour, 0, 0, 0),
    slotEnd: new Date(y, mo - 1, da, window.endHour, 0, 0, 0),
  };
}

function visitLocalHourSpanOnDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
): { startHour: number; endHourExclusive: number } | null {
  const { dayStart, dayEnd } = dayBounds(dateKey);
  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  const clampedStart = Math.max(vs, dayStart.getTime());
  const clampedEnd = Math.min(ve, dayEnd.getTime());
  if (clampedEnd <= clampedStart) return null;

  const start = new Date(clampedStart);
  const end = new Date(clampedEnd);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const endHourExclusive = Math.min(24, Math.max(startHour + 0.25, Math.ceil(endHour)));

  return { startHour, endHourExclusive };
}

/** Expand the visible timeline to fit visits on this day (with padding). */
export function resolveTimelineWindow(
  dateKey: string,
  visits: Array<{ starts_at: string; ends_at: string }>,
): TimelineWindow {
  const spans = visits
    .map((visit) => visitLocalHourSpanOnDay(visit, dateKey))
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

export function layoutVisitOnLocalDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
  window: TimelineWindow = DEFAULT_TIMELINE_WINDOW,
): { topPct: number; heightPct: number; visible: boolean } {
  const { slotStart, slotEnd } = slotBounds(dateKey, window);
  const totalMs = slotEnd.getTime() - slotStart.getTime();
  if (totalMs <= 0) return { topPct: 0, heightPct: 0, visible: false };

  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  const clampedStart = Math.max(vs, slotStart.getTime());
  const clampedEnd = Math.min(ve, slotEnd.getTime());
  if (clampedEnd <= clampedStart) return { topPct: 0, heightPct: 0, visible: false };

  const topPct = ((clampedStart - slotStart.getTime()) / totalMs) * 100;
  const heightPct = Math.max(((clampedEnd - clampedStart) / totalMs) * 100, 2.2);
  return { topPct, heightPct, visible: true };
}

export function visitOverlapsLocalDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
): boolean {
  const { dayStart, dayEnd } = dayBounds(dateKey);
  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  return vs <= dayEnd.getTime() && ve >= dayStart.getTime();
}

export function currentTimeLinePct(
  dateKey: string,
  window: TimelineWindow = DEFAULT_TIMELINE_WINDOW,
): number | null {
  const now = new Date();
  if (formatLocalYmd(now) !== dateKey) return null;

  const { slotStart, slotEnd } = slotBounds(dateKey, window);
  const t = now.getTime();
  if (t < slotStart.getTime() || t > slotEnd.getTime()) return null;
  const totalMs = slotEnd.getTime() - slotStart.getTime();
  return ((t - slotStart.getTime()) / totalMs) * 100;
}

/** Minimum timeline % we want free when expanding in a direction. */
const EXPAND_PANEL_MIN_PCT = 32;

/**
 * Pick whether an expanded visit card should grow down (from start time)
 * or up (anchored to end of the scheduled slot).
 */
export function resolveVisitExpandDirection(
  topPct: number,
  heightPct: number,
): 'up' | 'down' {
  const spaceAbove = topPct;
  const spaceBelowFromEnd = 100 - topPct - heightPct;
  const spaceBelowFromStart = 100 - topPct;

  if (spaceAbove < EXPAND_PANEL_MIN_PCT) return 'down';
  if (spaceBelowFromEnd < EXPAND_PANEL_MIN_PCT || spaceBelowFromStart < EXPAND_PANEL_MIN_PCT + 6) {
    return 'up';
  }
  return 'down';
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

export function formatVisitTimeRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleString(undefined, opts)}`;
}
