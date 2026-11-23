import { rrulestr } from 'rrule';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';

/**
 * Scope for an office edit of one visit that belongs to a recurring series.
 * `occurrence` changes that visit only. `future` ends the old series before
 * that visit and starts a new series from the edited visit.
 */
export type RecurringEditScope = 'occurrence' | 'future';

export type SplitVisit = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  checkedInAt: string | null;
  /** Set when a completion invoice or any tenant invoice points at the visit. */
  invoiced: boolean;
};

export type SeriesSplitRewrite = {
  id: string;
  startsAt: string;
  endsAt: string;
  /**
   * True when this visit was moved off the series grid. Its window is kept.
   * Crew, notes, and price edits still apply to it.
   */
  preserveWindow: boolean;
};

export type SeriesSplitPlan =
  | {
      ok: true;
      oldRrule: string;
      /** The edited visit is the first occurrence, so the old series is turned off. */
      deactivateOldSeries: boolean;
      newRrule: string;
      newAnchorStartsAt: string;
      newDurationMinutes: number;
      rewrites: SeriesSplitRewrite[];
      kept: Array<{ id: string; reason: 'before-split' | 'protected' }>;
      /** Original instants the old series must not materialize again. */
      oldSkips: string[];
      /**
       * Instants on the new series the materializer must skip. Used when a
       * kept exception, a protected visit, or a local-time shift does not land
       * on the UTC RRULE instant.
       */
      newSkips: string[];
    }
  | { ok: false; error: string };

const WEEKDAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

type RruleParts = Record<string, string>;

export function parseRecurringEditScope(raw: string | null | undefined): RecurringEditScope | null {
  const value = raw?.trim().toLowerCase() ?? '';
  if (value === 'occurrence') return 'occurrence';
  if (value === 'future') return 'future';
  return null;
}

export function parseRruleParts(rrule: string): RruleParts {
  const parts: RruleParts = {};
  for (const piece of rrule.split(';')) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    parts[trimmed.slice(0, eq).trim().toUpperCase()] = trimmed
      .slice(eq + 1)
      .trim()
      .toUpperCase();
  }
  return parts;
}

type ZonedCivil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function safeTimeZone(timeZone: string): string {
  const tz = timeZone.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz || 'UTC' });
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function zonedCivil(iso: string, timeZone: string): ZonedCivil | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  const weekdayLabel = value('weekday');
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayLabel ?? '');
  if (![year, month, day, hour, minute].every((n) => Number.isFinite(n)) || weekday < 0)
    return null;
  return { year, month, day, hour, minute, weekday };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function civilToIso(
  civil: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): string | null {
  return parseTenantDatetimeLocalToIso(
    `${civil.year}-${pad(civil.month)}-${pad(civil.day)}T${pad(civil.hour)}:${pad(civil.minute)}`,
    timeZone,
  );
}

function calendarDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function addCalendarDays(
  civil: { year: number; month: number; day: number },
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function instantMs(iso: string): number | null {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function utcCompact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function dtstartIcalLine(date: Date): string {
  return utcCompact(date);
}

/** Occurrences of a series between two instants, using the same UTC RRULE as the materializer. */
export function seriesOccurrenceStarts(params: {
  rruleDefinition: string;
  anchorStartsAt: string;
  from: Date;
  until: Date;
}): string[] {
  const anchor = new Date(params.anchorStartsAt);
  if (Number.isNaN(anchor.getTime())) return [];
  const definition = params.rruleDefinition.trim();
  if (!definition) return [];
  const full = `DTSTART:${dtstartIcalLine(anchor)}\nRRULE:${definition}`;
  const rule = rrulestr(full, { tzid: 'UTC' });
  return rule
    .between(params.from, params.until, true)
    .filter((dt) => dt.getTime() >= anchor.getTime())
    .map((dt) => dt.toISOString());
}

function rruleKeysInOrder(rrule: string): string[] {
  const keys: string[] = [];
  for (const piece of rrule.split(';')) {
    const key = piece.split('=')[0]?.trim().toUpperCase() ?? '';
    if (!key || keys.includes(key)) continue;
    keys.push(key);
  }
  return keys;
}

export function endSeriesBefore(rrule: string, splitStartsAt: string): string {
  const parts = parseRruleParts(rrule);
  delete parts.COUNT;
  const until = utcCompact(new Date(new Date(splitStartsAt).getTime() - 1000));
  const keys = rruleKeysInOrder(rrule).filter((key) => key !== 'COUNT' && key !== 'UNTIL');
  return [...keys.map((key) => `${key}=${parts[key]}`), `UNTIL=${until}`].join(';');
}

export function openSeriesRrule(rrule: string, editedStartsAt: string, timeZone: string): string {
  const parts = parseRruleParts(rrule);
  delete parts.UNTIL;
  delete parts.COUNT;
  const civil = zonedCivil(editedStartsAt, timeZone);
  if (civil && parts.FREQ === 'WEEKLY' && parts.BYDAY) {
    const code = WEEKDAY_CODE[civil.weekday];
    if (code) parts.BYDAY = code;
  }
  if (civil && parts.FREQ === 'MONTHLY' && parts.BYMONTHDAY) {
    parts.BYMONTHDAY = String(civil.day);
  }
  const keys = rruleKeysInOrder(rrule).filter((key) => parts[key]);
  return keys.map((key) => `${key}=${parts[key]}`).join(';');
}

function isProtected(visit: SplitVisit): boolean {
  return visit.status !== 'scheduled' || visit.checkedInAt != null || visit.invoiced;
}

function dayDistance(left: string, right: string, timeZone: string): number | null {
  const a = zonedCivil(left, timeZone);
  const b = zonedCivil(right, timeZone);
  if (!a || !b) return null;
  return Math.abs(
    calendarDayNumber(a.year, a.month, a.day) - calendarDayNumber(b.year, b.month, b.day),
  );
}

function sameLocalMonth(left: string, right: string, timeZone: string): boolean {
  const a = zonedCivil(left, timeZone);
  const b = zonedCivil(right, timeZone);
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month;
}

/**
 * Explicitly moved visits keep their window. A future visit counts as moved when
 * a skip row still points at it, or its start is not an occurrence of the old rule.
 * The nearest on-grid slot within 3 days (weekly) or the same month (monthly) is
 * skipped on the new series so the materializer does not add a second visit.
 * A move farther than that is kept and does not suppress another occurrence.
 */
function matchesSeriesLocalSlot(
  visitStartsAt: string,
  anchorStartsAt: string,
  rrule: string,
  timeZone: string,
): boolean {
  const visitCivil = zonedCivil(visitStartsAt, timeZone);
  const anchorCivil = zonedCivil(anchorStartsAt, timeZone);
  if (!visitCivil || !anchorCivil) return false;
  if (visitCivil.hour !== anchorCivil.hour || visitCivil.minute !== anchorCivil.minute)
    return false;
  const parts = parseRruleParts(rrule);
  if (parts.FREQ === 'WEEKLY' && parts.BYDAY) {
    const code = WEEKDAY_CODE[visitCivil.weekday];
    return code != null && parts.BYDAY.split(',').includes(code);
  }
  if (parts.FREQ === 'MONTHLY' && parts.BYMONTHDAY) {
    return String(visitCivil.day) === parts.BYMONTHDAY;
  }
  return false;
}

/**
 * A future visit keeps its window when a skip row points at it, or when it is
 * neither an RRULE instant nor the series' local weekday and time. Local time
 * is the match so a 9:00 AM visit stays on the series across DST even though
 * the materializer expands the rule in UTC.
 */
function isMovedVisit(
  visit: SplitVisit,
  movedVisitIds: ReadonlySet<string>,
  gridMs: ReadonlySet<number>,
  anchorStartsAt: string,
  rrule: string,
  timeZone: string,
): boolean {
  if (movedVisitIds.has(visit.id)) return true;
  const start = instantMs(visit.startsAt);
  if (start != null && gridMs.has(start)) return false;
  return !matchesSeriesLocalSlot(visit.startsAt, anchorStartsAt, rrule, timeZone);
}

function nearestOccurrence(params: {
  targetStartsAt: string;
  occurrences: readonly string[];
  timeZone: string;
  freq: string;
  claimed: Set<number>;
}): string | null {
  const maxDays = params.freq === 'MONTHLY' ? 20 : params.freq === 'WEEKLY' ? 3 : 0;
  if (maxDays === 0) return null;
  let best: { iso: string; delta: number } | null = null;
  for (const iso of params.occurrences) {
    const ms = instantMs(iso);
    if (ms == null || params.claimed.has(ms)) continue;
    if (params.freq === 'MONTHLY' && !sameLocalMonth(params.targetStartsAt, iso, params.timeZone)) {
      continue;
    }
    const delta = dayDistance(params.targetStartsAt, iso, params.timeZone);
    if (delta == null || delta > maxDays) continue;
    if (!best || delta < best.delta) best = { iso, delta };
  }
  return best?.iso ?? null;
}

function shiftWindow(params: {
  visitStartsAt: string;
  splitStartsAt: string;
  editedStartsAt: string;
  durationMinutes: number;
  timeZone: string;
}): { startsAt: string; endsAt: string } | null {
  const splitCivil = zonedCivil(params.splitStartsAt, params.timeZone);
  const editedCivil = zonedCivil(params.editedStartsAt, params.timeZone);
  const visitCivil = zonedCivil(params.visitStartsAt, params.timeZone);
  if (!splitCivil || !editedCivil || !visitCivil) return null;
  const dayDelta =
    calendarDayNumber(editedCivil.year, editedCivil.month, editedCivil.day) -
    calendarDayNumber(splitCivil.year, splitCivil.month, splitCivil.day);
  const shiftedDay = addCalendarDays(visitCivil, dayDelta);
  const startsAt = civilToIso(
    {
      ...shiftedDay,
      hour: editedCivil.hour,
      minute: editedCivil.minute,
    },
    params.timeZone,
  );
  if (!startsAt) return null;
  const endsAt = new Date(
    new Date(startsAt).getTime() + params.durationMinutes * 60_000,
  ).toISOString();
  return { startsAt, endsAt };
}

export function planRecurringSeriesSplit(input: {
  timeZone: string;
  rruleDefinition: string;
  anchorStartsAt: string;
  editedVisitId: string;
  splitStartsAt: string;
  editedStartsAt: string;
  editedEndsAt: string;
  visits: readonly SplitVisit[];
  movedVisitIds: readonly string[];
  /** How far past the latest visit to expand the RRULE when looking for slots. */
  horizonDays?: number;
}): SeriesSplitPlan {
  const splitMs = instantMs(input.splitStartsAt);
  const editedStartMs = instantMs(input.editedStartsAt);
  const editedEndMs = instantMs(input.editedEndsAt);
  const anchorMs = instantMs(input.anchorStartsAt);
  if (splitMs == null || editedStartMs == null || editedEndMs == null || anchorMs == null) {
    return { ok: false, error: 'That visit time is not valid.' };
  }
  if (editedEndMs <= editedStartMs) {
    return { ok: false, error: 'End time must be after start time.' };
  }
  const durationMinutes = Math.round((editedEndMs - editedStartMs) / 60_000);
  if (durationMinutes < 1 || durationMinutes > 24 * 60) {
    return { ok: false, error: 'Visit length must be between 1 minute and 24 hours.' };
  }

  const edited = input.visits.find((visit) => visit.id === input.editedVisitId);
  if (!edited) return { ok: false, error: 'Visit not found on this series.' };
  if (isProtected(edited)) {
    return {
      ok: false,
      error:
        'Completed, checked-in, or invoiced visits stay as they are. Choose an upcoming visit.',
    };
  }

  const horizonDays = Math.min(120, Math.max(1, input.horizonDays ?? 60));
  const latestMs = input.visits.reduce((max, visit) => {
    const ms = instantMs(visit.startsAt) ?? 0;
    return Math.max(max, ms);
  }, splitMs);
  const from = new Date(anchorMs - 86_400_000);
  const until = new Date(latestMs + (horizonDays + 21) * 86_400_000);

  let oldGrid: string[] = [];
  let newRrule = '';
  let newGrid: string[] = [];
  try {
    oldGrid = seriesOccurrenceStarts({
      rruleDefinition: input.rruleDefinition,
      anchorStartsAt: input.anchorStartsAt,
      from,
      until,
    });
    newRrule = openSeriesRrule(input.rruleDefinition, input.editedStartsAt, input.timeZone);
    newGrid = seriesOccurrenceStarts({
      rruleDefinition: newRrule,
      anchorStartsAt: input.editedStartsAt,
      from,
      until,
    });
  } catch {
    return { ok: false, error: 'This repeat rule cannot be split.' };
  }

  const freq = parseRruleParts(input.rruleDefinition).FREQ ?? '';
  const gridMs = new Set(
    oldGrid.map((iso) => instantMs(iso)).filter((ms): ms is number => ms != null),
  );
  const movedIds = new Set(input.movedVisitIds);
  const rewrites: SeriesSplitRewrite[] = [];
  const kept: Array<{ id: string; reason: 'before-split' | 'protected' }> = [];
  const oldSkipMs = new Set<number>();
  const protectedFuture: SplitVisit[] = [];

  for (const visit of input.visits) {
    const start = instantMs(visit.startsAt);
    if (start == null) return { ok: false, error: 'That visit time is not valid.' };
    if (start < splitMs) {
      kept.push({ id: visit.id, reason: 'before-split' });
      continue;
    }
    if (visit.id !== input.editedVisitId && isProtected(visit)) {
      kept.push({ id: visit.id, reason: 'protected' });
      protectedFuture.push(visit);
      const original = instantMs(visit.startsAt);
      if (original != null) oldSkipMs.add(original);
      continue;
    }

    const preserveWindow =
      visit.id !== input.editedVisitId &&
      isMovedVisit(
        visit,
        movedIds,
        gridMs,
        input.anchorStartsAt,
        input.rruleDefinition,
        input.timeZone,
      );
    if (visit.id === input.editedVisitId) {
      rewrites.push({
        id: visit.id,
        startsAt: new Date(editedStartMs).toISOString(),
        endsAt: new Date(editedEndMs).toISOString(),
        preserveWindow: false,
      });
    } else if (preserveWindow) {
      rewrites.push({
        id: visit.id,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(visit.endsAt).toISOString(),
        preserveWindow: true,
      });
    } else {
      const shifted = shiftWindow({
        visitStartsAt: visit.startsAt,
        splitStartsAt: input.splitStartsAt,
        editedStartsAt: input.editedStartsAt,
        durationMinutes,
        timeZone: input.timeZone,
      });
      if (!shifted) {
        return {
          ok: false,
          error: 'That time does not exist in this workspace timezone. Choose another time.',
        };
      }
      rewrites.push({ id: visit.id, ...shifted, preserveWindow: false });
    }

    oldSkipMs.add(start);
    if (preserveWindow) {
      const replaced = nearestOccurrence({
        targetStartsAt: visit.startsAt,
        occurrences: oldGrid,
        timeZone: input.timeZone,
        freq,
        claimed: new Set(
          input.visits
            .filter((row) => row.id !== visit.id)
            .map((row) => instantMs(row.startsAt))
            .filter((ms): ms is number => ms != null),
        ),
      });
      const replacedMs = replaced ? instantMs(replaced) : null;
      if (replacedMs != null) oldSkipMs.add(replacedMs);
    }
  }

  const seen = new Set<number>();
  for (const rewrite of rewrites) {
    const ms = instantMs(rewrite.startsAt);
    if (ms == null) return { ok: false, error: 'That visit time is not valid.' };
    if (seen.has(ms)) {
      return { ok: false, error: 'Two visits in this series would land on the same time.' };
    }
    seen.add(ms);
  }

  const claimed = new Set<number>(seen);
  const newSkips: string[] = [];
  const claimSkip = (target: string, always: boolean) => {
    const slot = nearestOccurrence({
      targetStartsAt: target,
      occurrences: newGrid,
      timeZone: input.timeZone,
      freq,
      claimed,
    });
    if (!slot) return;
    const slotMs = instantMs(slot);
    const targetMs = instantMs(target);
    if (slotMs == null || targetMs == null) return;
    if (!always && slotMs === targetMs) return;
    newSkips.push(new Date(slotMs).toISOString());
    claimed.add(slotMs);
  };

  for (const rewrite of rewrites) claimSkip(rewrite.startsAt, false);
  for (const visit of protectedFuture) {
    const shifted = shiftWindow({
      visitStartsAt: visit.startsAt,
      splitStartsAt: input.splitStartsAt,
      editedStartsAt: input.editedStartsAt,
      durationMinutes,
      timeZone: input.timeZone,
    });
    claimSkip(shifted?.startsAt ?? visit.startsAt, true);
  }

  const deactivateOldSeries = anchorMs >= splitMs;
  return {
    ok: true,
    oldRrule: endSeriesBefore(input.rruleDefinition, input.splitStartsAt),
    deactivateOldSeries,
    newRrule,
    newAnchorStartsAt: new Date(editedStartMs).toISOString(),
    newDurationMinutes: durationMinutes,
    rewrites,
    kept,
    oldSkips: [...oldSkipMs].sort((a, b) => a - b).map((ms) => new Date(ms).toISOString()),
    newSkips,
  };
}
