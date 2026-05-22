export type ScheduleView = 'day' | 'week' | 'month' | 'today';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeDateKey(raw: string | string[] | undefined): string {
  const t = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  if (DATE_RE.test(t)) return t;
  return new Date().toISOString().slice(0, 10);
}

export function normalizeView(
  raw: string | string[] | undefined,
  options?: { defaultForFieldEmployee?: boolean },
): ScheduleView {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? '';
  if (v === 'week' || v === 'month' || v === 'day' || v === 'today') return v;
  if (options?.defaultForFieldEmployee) return 'today';
  return 'day';
}

export type ScheduleEmployeeFilter = 'all' | 'me' | string;

export function normalizeEmployeeFilter(
  raw: string | string[] | undefined,
  defaultForRole?: 'employee' | 'owner' | 'admin' | 'viewer',
): ScheduleEmployeeFilter {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  if (v === 'all' || v === 'me') return v;
  if (UUID_RE.test(v)) return v;
  return defaultForRole === 'employee' ? 'me' : 'all';
}

export function buildScheduleSearchParams(params: {
  date?: string;
  view?: ScheduleView;
  employee?: string;
}): string {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.view) q.set('view', params.view);
  if (params.employee && params.employee !== 'all') q.set('employee', params.employee);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** UTC bounds for DB overlap: visits where starts_at <= end AND ends_at >= start. */
export function visibleRangeUtc(
  view: ScheduleView,
  dateKey: string,
): { start: string; end: string } {
  const d = new Date(`${dateKey}T12:00:00.000Z`);

  if (view === 'day' || view === 'today') {
    return {
      start: `${dateKey}T00:00:00.000Z`,
      end: `${dateKey}T23:59:59.999Z`,
    };
  }

  if (view === 'week') {
    const dow = d.getUTCDay();
    const offsetToMonday = (dow + 6) % 7;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - offsetToMonday);
    mon.setUTCHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    sun.setUTCHours(23, 59, 59, 999);
    return { start: mon.toISOString(), end: sun.toISOString() };
  }

  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function shiftDateKeyByMonths(dateKey: string, deltaMonths: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + deltaMonths);
  return d.toISOString().slice(0, 10);
}

/** Monday–Sunday UTC date keys for the week containing `dateKey`. */
export function utcWeekDayKeys(dateKey: string): string[] {
  const { start } = visibleRangeUtc('week', dateKey);
  const d = new Date(start);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    keys.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return keys;
}

export function isUtcDateKeyToday(dateKey: string): boolean {
  return dateKey === new Date().toISOString().slice(0, 10);
}

/** Matches the browser-local calendar in Node (server) for subtitle copy. */
export function isLocalCalendarToday(dateKey: string): boolean {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === dateKey;
}

export function visitOverlapsUtcCalendarDay(
  visit: { starts_at: string; ends_at: string },
  dateKey: string,
): boolean {
  const ds = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const de = new Date(`${dateKey}T23:59:59.999Z`).getTime();
  const vs = new Date(visit.starts_at).getTime();
  const ve = new Date(visit.ends_at).getTime();
  return vs <= de && ve >= ds;
}

export function buildUtcMonthGrid(
  dateKey: string,
): { key: string; inMonth: boolean; day: number }[] {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const pad = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - pad);
  const cells: { key: string; inMonth: boolean; day: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const c = new Date(start);
    c.setUTCDate(start.getUTCDate() + i);
    cells.push({
      key: c.toISOString().slice(0, 10),
      inMonth: c.getUTCMonth() === m,
      day: c.getUTCDate(),
    });
  }
  return cells;
}

/** Widen day fetch so visits crossing local midnight still load (overlap query). */
export function dbOverlapRangeForQuery(
  view: ScheduleView,
  dateKey: string,
): { start: string; end: string } {
  if (view === 'day' || view === 'today') {
    return {
      start: `${shiftDateKey(dateKey, -1)}T00:00:00.000Z`,
      end: `${shiftDateKey(dateKey, 1)}T23:59:59.999Z`,
    };
  }
  return visibleRangeUtc(view, dateKey);
}
