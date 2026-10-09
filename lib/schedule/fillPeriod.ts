import { shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';

export type FillScope = 'day' | 'week' | 'month' | 'range';

const WEEKDAY_FROM_UTC: WorkWeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEK_INDEX: Record<WorkWeekDayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month! - 1 && utc.getUTCDate() === day
  );
}

export function dateKeyWeekday(dateKey: string): WorkWeekDayKey {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAY_FROM_UTC[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()] ?? 'mon';
}

export function diffDateKeys(later: string, earlier: string): number {
  const [ay, am, ad] = earlier.split('-').map(Number);
  const [by, bm, bd] = later.split('-').map(Number);
  return Math.round(
    (Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000,
  );
}

export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(year!, month! - 1 + months, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day!, last);
  const y = cursor.getUTCFullYear();
  const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
  const d = String(clamped).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayOf(dateKey: string): string {
  return shiftDateKey(dateKey, -WEEK_INDEX[dateKeyWeekday(dateKey)]);
}

function monthBounds(dateKey: string): { start: string; end: string } {
  const [year, month] = dateKey.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return { start, end: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}

export function eachDateKey(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 70) {
    dates.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return dates;
}

/** Inclusive bounds. Past days are dropped. A range longer than 62 days is rejected. */
export function resolveFillBounds(input: {
  scope: FillScope;
  anchorDate: string;
  rangeStart?: string;
  rangeEnd?: string;
  today: string;
}): { start: string; end: string } | { error: string } {
  if (!isDateKey(input.today) || !isDateKey(input.anchorDate)) {
    return { error: 'Choose a valid date.' };
  }

  let start = input.anchorDate;
  let end = input.anchorDate;
  if (input.scope === 'week') {
    start = mondayOf(input.anchorDate);
    end = shiftDateKey(start, 6);
  } else if (input.scope === 'month') {
    const bounds = monthBounds(input.anchorDate);
    start = bounds.start;
    end = bounds.end;
  } else if (input.scope === 'range') {
    start = input.rangeStart ?? '';
    end = input.rangeEnd ?? '';
    if (!isDateKey(start) || !isDateKey(end)) return { error: 'Enter a start and end date.' };
    if (end < start) return { error: 'The end date has to be on or after the start date.' };
  }

  if (start < input.today) start = input.today;
  if (end < start) return { error: 'That period is already over.' };
  if (diffDateKeys(end, start) > 61) {
    return { error: 'Fill at most 62 days at a time.' };
  }
  return { start, end };
}

export type FillServiceDemand = {
  key: string;
  customerId: string;
  customerName: string;
  title: string;
  frequency: QuoteLineFrequency;
  durationMinutes: number;
  /** Last scheduled or completed visit, as a date key. */
  anchorDate: string | null;
  existingDates: string[];
  arrivalStartMin: number | null;
  quoteId: string;
  lineId: string;
  propertyId: string | null;
  amountCents: number | null;
};

export type FillConsultationDemand = {
  key: string;
  leadId: string;
  customerId: string | null;
  customerName: string;
  preferredDate: string | null;
  preferredWindow: string | null;
  durationMinutes: number;
  /** True when this person already has a consultation on the calendar. */
  alreadyBooked: boolean;
};

export type FillProposal = {
  key: string;
  customerId: string | null;
  leadId: string | null;
  customerName: string;
  title: string;
  dateKey: string;
  startMin: number;
  durationMinutes: number;
  kind: 'service' | 'consultation';
  quoteId: string | null;
  lineId: string | null;
  propertyId: string | null;
  amountCents: number | null;
};

export type FillSkip = { label: string; reason: string };

function cadenceDays(frequency: QuoteLineFrequency): number | null {
  if (frequency === 'weekly' || frequency === 'custom') return 7;
  if (frequency === 'biweekly') return 14;
  return null;
}

function tooClose(dateKey: string, existing: string[], gapDays: number): boolean {
  return existing.some((other) => Math.abs(diffDateKeys(dateKey, other)) < gapDays);
}

function nextOpenDay(
  from: string,
  rangeEnd: string,
  openDays: ReadonlySet<WorkWeekDayKey>,
  maxLookahead: number,
): string | null {
  let cursor = from;
  for (let step = 0; step <= maxLookahead && cursor <= rangeEnd; step += 1) {
    if (openDays.has(dateKeyWeekday(cursor))) return cursor;
    cursor = shiftDateKey(cursor, 1);
  }
  return null;
}

function placeStartMinute(
  preferred: number | null,
  workStartMin: number,
  workEndMin: number,
  durationMinutes: number,
): number {
  const latest = workEndMin - durationMinutes;
  const floor = workStartMin;
  const ceiling = latest >= floor ? latest : floor;
  const wanted = preferred ?? floor;
  return Math.min(Math.max(wanted, floor), ceiling);
}

export function preferredWindowStartMin(window: string | null): number | null {
  if (window === 'afternoon') return 12 * 60;
  if (window === 'evening') return 16 * 60;
  if (window === 'morning') return 8 * 60;
  return null;
}

/**
 * Dates a demand should occupy inside the range.
 * Recurring work keeps the customer's gap. One-time work is placed once.
 * A closed weekday moves forward onto the next open day, still inside the gap.
 */
export function planFillPeriod(input: {
  start: string;
  end: string;
  workDays: WorkWeekDayKey[];
  workStartMin: number;
  workEndMin: number;
  services: FillServiceDemand[];
  consultations: FillConsultationDemand[];
}): { proposals: FillProposal[]; skipped: FillSkip[] } {
  const open = new Set(input.workDays);
  const proposals: FillProposal[] = [];
  const skipped: FillSkip[] = [];
  const taken = new Map<string, Set<string>>();

  const mark = (customerId: string, dateKey: string) => {
    const set = taken.get(customerId) ?? new Set<string>();
    set.add(dateKey);
    taken.set(customerId, set);
  };

  for (const service of input.services) {
    for (const dateKey of service.existingDates) mark(service.customerId, dateKey);
  }

  for (const service of input.services) {
    const occupied = () => [...(taken.get(service.customerId) ?? [])];
    const gap = cadenceDays(service.frequency);
    const dates: string[] = [];

    if (service.frequency === 'one_time') {
      if (service.existingDates.length > 0) {
        skipped.push({
          label: service.customerName,
          reason: `${service.title} is already on the calendar.`,
        });
        continue;
      }
      const day = nextOpenDay(input.start, input.end, open, diffDateKeys(input.end, input.start));
      if (!day || taken.get(service.customerId)?.has(day)) {
        skipped.push({
          label: service.customerName,
          reason: `${service.title} has no open workday in this period.`,
        });
        continue;
      }
      dates.push(day);
      mark(service.customerId, day);
    } else if (service.frequency === 'monthly') {
      let cursor = service.anchorDate ?? input.start;
      if (cursor < input.start) {
        while (cursor < input.start) cursor = addMonthsToDateKey(cursor, 1);
      }
      while (cursor <= input.end && dates.length < 3) {
        const day = nextOpenDay(cursor, input.end, open, 6);
        if (
          day &&
          day >= input.start &&
          day <= input.end &&
          !tooClose(day, occupied(), 20) &&
          !taken.get(service.customerId)?.has(day)
        ) {
          dates.push(day);
          mark(service.customerId, day);
        }
        cursor = addMonthsToDateKey(cursor, 1);
      }
    } else if (gap) {
      // A visit that fell on a closed day, or a day or two before this period,
      // can move onto the next open day. It cannot jump a whole extra cadence.
      let due = service.anchorDate ? shiftDateKey(service.anchorDate, gap) : input.start;
      let guard = 0;
      while (due <= input.end && guard < 16) {
        guard += 1;
        const target = due < input.start ? input.start : due;
        const horizon = shiftDateKey(due, gap - 1);
        const day = nextOpenDay(target, horizon < input.end ? horizon : input.end, open, gap - 1);
        const stillThisOccurrence = day != null && diffDateKeys(day, due) < gap && diffDateKeys(day, due) >= 0;
        if (
          stillThisOccurrence &&
          day &&
          day >= input.start &&
          day <= input.end &&
          !tooClose(day, occupied(), gap) &&
          !taken.get(service.customerId)?.has(day)
        ) {
          dates.push(day);
          mark(service.customerId, day);
          due = shiftDateKey(day, gap);
        } else {
          due = shiftDateKey(due, gap);
        }
      }
    }

    if (dates.length === 0 && service.frequency !== 'one_time') {
      skipped.push({
        label: service.customerName,
        reason: `${service.title} is not due again in this period.`,
      });
    }

    for (const dateKey of dates) {
      proposals.push({
        key: `${service.key}:${dateKey}`,
        customerId: service.customerId,
        leadId: null,
        customerName: service.customerName,
        title: service.title,
        dateKey,
        startMin: placeStartMinute(
          service.arrivalStartMin,
          input.workStartMin,
          input.workEndMin,
          service.durationMinutes,
        ),
        durationMinutes: service.durationMinutes,
        kind: 'service',
        quoteId: service.quoteId,
        lineId: service.lineId,
        propertyId: service.propertyId,
        amountCents: service.amountCents,
      });
    }
  }

  for (const lead of input.consultations) {
    if (lead.alreadyBooked) {
      skipped.push({
        label: lead.customerName,
        reason: 'A consultation is already scheduled.',
      });
      continue;
    }
    if (lead.preferredDate && isDateKey(lead.preferredDate) && lead.preferredDate > input.end) {
      skipped.push({
        label: lead.customerName,
        reason: `They asked for ${lead.preferredDate}, which is after this period.`,
      });
      continue;
    }
    if (lead.preferredDate && isDateKey(lead.preferredDate) && lead.preferredDate < input.start) {
      skipped.push({
        label: lead.customerName,
        reason: `They asked for ${lead.preferredDate}, which is before this period.`,
      });
      continue;
    }
    const from =
      lead.preferredDate && isDateKey(lead.preferredDate) ? lead.preferredDate : input.start;
    const day = nextOpenDay(from, input.end, open, 6);
    if (!day) {
      skipped.push({
        label: lead.customerName,
        reason: 'No open workday left for a consultation.',
      });
      continue;
    }
    proposals.push({
      key: lead.key,
      customerId: lead.customerId,
      leadId: lead.leadId,
      customerName: lead.customerName,
      title: 'Consultation',
      dateKey: day,
      startMin: placeStartMinute(
        preferredWindowStartMin(lead.preferredWindow),
        input.workStartMin,
        input.workEndMin,
        lead.durationMinutes,
      ),
      durationMinutes: lead.durationMinutes,
      kind: 'consultation',
      quoteId: null,
      lineId: null,
      propertyId: null,
      amountCents: null,
    });
  }

  proposals.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startMin - b.startMin);
  return { proposals, skipped };
}
