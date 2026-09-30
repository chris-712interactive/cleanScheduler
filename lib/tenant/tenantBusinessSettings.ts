import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { parseCssColorToHex } from '@/lib/ui/parseCssColor';

export const DEFAULT_BRAND_COLOR = '#0D9488';

export const WORK_WEEK_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WorkWeekDayKey = (typeof WORK_WEEK_DAY_KEYS)[number];

export const WORK_WEEK_DAY_LABEL: Record<WorkWeekDayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const DEFAULT_WORK_WEEK_DAYS: WorkWeekDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const TENANT_TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time (US & Canada)' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { value: 'America/Phoenix', label: '(UTC-07:00) Arizona' },
  { value: 'America/Toronto', label: '(UTC-05:00) Eastern Time — Toronto' },
  { value: 'America/Vancouver', label: '(UTC-08:00) Pacific Time — Vancouver' },
  { value: 'UTC', label: '(UTC+00:00) Coordinated Universal Time' },
] as const;

export const TENANT_COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
] as const;

export const US_STATE_OPTIONS = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const;

const VALID_TIMEZONES = new Set<string>(TENANT_TIMEZONE_OPTIONS.map((o) => o.value));

export function parseTenantTimezone(raw: string): string {
  const value = raw.trim();
  if (VALID_TIMEZONES.has(value)) return value;
  return DEFAULT_TENANT_TIMEZONE;
}

export function parseBrandColor(raw: string): string | null {
  return parseCssColorToHex(raw);
}

export function parseWorkWeekDaysFromForm(formData: FormData): WorkWeekDayKey[] | null {
  const selected = WORK_WEEK_DAY_KEYS.filter((day) => formData.get(`work_day_${day}`) === 'on');
  if (selected.length === 0) return null;
  return selected;
}

/** Normalize Postgres `time` or HH:MM to HH:MM for `<select>` values. */
export function normalizeWorkTimeValue(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return '08:00';
  return `${match[1]}:${match[2]}`;
}

export function parseWorkTimeFromForm(raw: string): string | null {
  const value = raw.trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return null;
  return value;
}

export type WorkDayWindow = { start: string; end: string };

export type WorkDaySchedule = {
  weekday: WorkWeekDayKey;
  enabled: boolean;
  start: string;
  end: string;
};

export function openWorkDayHours(
  days: WorkDaySchedule[],
): Partial<Record<WorkWeekDayKey, WorkDayWindow>> {
  const hours: Partial<Record<WorkWeekDayKey, WorkDayWindow>> = {};
  for (const day of days) {
    if (!day.enabled) continue;
    hours[day.weekday] = { start: day.start, end: day.end };
  }
  return hours;
}

export function resolveWorkDayWindow(
  dayKey: WorkWeekDayKey,
  input: {
    workWeekDays?: WorkWeekDayKey[];
    workDayStart: string;
    workDayEnd: string;
    workDayHours?: Partial<Record<WorkWeekDayKey, WorkDayWindow>> | null;
  },
): WorkDayWindow | null {
  if (input.workDayHours && Object.keys(input.workDayHours).length > 0) {
    return input.workDayHours[dayKey] ?? null;
  }
  const workWeekDays =
    input.workWeekDays && input.workWeekDays.length > 0
      ? input.workWeekDays
      : [...DEFAULT_WORK_WEEK_DAYS];
  if (!workWeekDays.includes(dayKey)) return null;
  return { start: input.workDayStart, end: input.workDayEnd };
}

function isWorkDayWindow(value: unknown): value is WorkDayWindow {
  if (!value || typeof value !== 'object') return false;
  const window = value as { start?: unknown; end?: unknown };
  return (
    typeof window.start === 'string' &&
    typeof window.end === 'string' &&
    parseWorkTimeFromForm(window.start) === window.start &&
    parseWorkTimeFromForm(window.end) === window.end &&
    window.start < window.end
  );
}

export function parseStoredWorkDayHours(
  raw: unknown,
): Partial<Record<WorkWeekDayKey, WorkDayWindow>> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const hours: Partial<Record<WorkWeekDayKey, WorkDayWindow>> = {};
  for (const day of WORK_WEEK_DAY_KEYS) {
    const window = record[day];
    if (!isWorkDayWindow(window)) continue;
    hours[day] = { start: window.start, end: window.end };
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

export function workDaySchedulesFromHours(input: {
  workWeekDays: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  workDayHours: Partial<Record<WorkWeekDayKey, WorkDayWindow>> | null;
}): WorkDaySchedule[] {
  const enabled = new Set(input.workWeekDays);
  return WORK_WEEK_DAY_KEYS.map((weekday) => {
    const stored = input.workDayHours?.[weekday];
    const open = input.workDayHours ? Boolean(stored) : enabled.has(weekday);
    return {
      weekday,
      enabled: open,
      start: stored?.start ?? input.workDayStart,
      end: stored?.end ?? input.workDayEnd,
    };
  });
}

export function parseWorkDaySchedulesFromForm(
  formData: FormData,
): { ok: true; days: WorkDaySchedule[] } | { ok: false; error: string } {
  const days: WorkDaySchedule[] = [];
  for (const weekday of WORK_WEEK_DAY_KEYS) {
    const enabled = formData.get(`work_day_${weekday}`) === 'on';
    const start = parseWorkTimeFromForm(String(formData.get(`work_day_${weekday}_start`) ?? ''));
    const end = parseWorkTimeFromForm(String(formData.get(`work_day_${weekday}_end`) ?? ''));
    if (enabled && (!start || !end)) {
      return {
        ok: false,
        error: `Choose a start and end time for ${WORK_WEEK_DAY_LABEL[weekday]}.`,
      };
    }
    if (enabled && start && end && start >= end) {
      return { ok: false, error: `${WORK_WEEK_DAY_LABEL[weekday]} must end after it starts.` };
    }
    days.push({
      weekday,
      enabled,
      start: start ?? '08:00',
      end: end ?? '17:00',
    });
  }
  if (!days.some((day) => day.enabled)) {
    return { ok: false, error: 'Open at least one day.' };
  }
  return { ok: true, days };
}

export function legacyWorkWeekFromSchedules(days: WorkDaySchedule[]): {
  workWeekDays: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  workDayHours: Partial<Record<WorkWeekDayKey, WorkDayWindow>>;
} {
  const open = days.filter((day) => day.enabled);
  return {
    workWeekDays: open.map((day) => day.weekday),
    workDayStart: open[0]?.start ?? '08:00',
    workDayEnd: open[0]?.end ?? '17:00',
    workDayHours: openWorkDayHours(days),
  };
}

export function summarizeWorkDaySchedule(days: WorkDaySchedule[]): string {
  const open = days.filter((day) => day.enabled);
  if (open.length === 0) return 'No open days';
  const sameHours = open.every((day) => day.start === open[0]?.start && day.end === open[0]?.end);
  const labels = open.map((day) => WORK_WEEK_DAY_LABEL[day.weekday]).join(', ');
  if (sameHours && open[0]) return `${labels} · ${open[0].start}–${open[0].end}`;
  return open
    .map((day) => `${WORK_WEEK_DAY_LABEL[day.weekday]} ${day.start}–${day.end}`)
    .join(', ');
}

export function buildWorkTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const date = new Date(`1970-01-01T${value}:00`);
      const label = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      options.push({ value, label });
    }
  }
  return options;
}

export function formatTimezoneLabel(timezone: string): string {
  const match = TENANT_TIMEZONE_OPTIONS.find((option) => option.value === timezone);
  return match?.label ?? timezone;
}

export interface TenantBusinessSnapshot {
  name: string;
  businessEmail: string;
  businessPhone: string;
  timezone: string;
  customerReviewUrl: string;
  brandColor: string;
  logoUrl: string | null;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  workWeekDays: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
  workDays: WorkDaySchedule[];
}

/** Accept empty or https:// review URLs only. */
export function parseCustomerReviewUrl(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function tenantBusinessSnapshotFromRow(row: {
  name: string;
  timezone: string;
  business_email: string | null;
  business_phone: string | null;
  customer_review_url?: string | null;
  brand_color: string | null;
  logo_url: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  work_week_days: string[] | null;
  work_day_start: string | null;
  work_day_end: string | null;
  work_day_hours?: unknown;
}): TenantBusinessSnapshot {
  const workWeekDays = (row.work_week_days ?? DEFAULT_WORK_WEEK_DAYS).filter(
    (day): day is WorkWeekDayKey => WORK_WEEK_DAY_KEYS.includes(day as WorkWeekDayKey),
  );
  const openDays = workWeekDays.length > 0 ? workWeekDays : [...DEFAULT_WORK_WEEK_DAYS];
  const workDayStart = normalizeWorkTimeValue(row.work_day_start);
  const workDayEnd = normalizeWorkTimeValue(row.work_day_end);
  const workDays = workDaySchedulesFromHours({
    workWeekDays: openDays,
    workDayStart,
    workDayEnd,
    workDayHours: parseStoredWorkDayHours(row.work_day_hours),
  });

  return {
    name: row.name?.trim() || '',
    businessEmail: row.business_email?.trim() || '',
    businessPhone: row.business_phone?.trim() || '',
    timezone: row.timezone?.trim() || DEFAULT_TENANT_TIMEZONE,
    customerReviewUrl: row.customer_review_url?.trim() || '',
    brandColor: row.brand_color?.trim() || DEFAULT_BRAND_COLOR,
    logoUrl: row.logo_url?.trim() || null,
    addressLine1: row.address_line1?.trim() || '',
    city: row.city?.trim() || '',
    state: row.state?.trim() || '',
    postalCode: row.postal_code?.trim() || '',
    country: row.country?.trim() || 'US',
    workWeekDays: workDays.filter((day) => day.enabled).map((day) => day.weekday),
    workDayStart,
    workDayEnd,
    workDays,
  };
}
