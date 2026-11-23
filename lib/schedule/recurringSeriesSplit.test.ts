import { describe, expect, it } from 'vitest';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import {
  clampMonthDay,
  endSeriesBefore,
  openSeriesRrule,
  parseRecurringEditScope,
  planRecurringSeriesSplit,
  seriesOccurrenceStarts,
  zonedCivil,
  type SplitVisit,
} from '@/lib/schedule/recurringSeriesSplit';

const TZ = 'America/New_York';
const WEEKLY = 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1';

function at(local: string): string {
  const iso = parseTenantDatetimeLocalToIso(local, TZ);
  if (!iso) throw new Error(`bad local time ${local}`);
  return iso;
}

function visit(
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<SplitVisit> = {},
): SplitVisit {
  return {
    id,
    startsAt,
    endsAt,
    status: 'scheduled',
    checkedInAt: null,
    invoiced: false,
    ...extra,
  };
}

describe('parseRecurringEditScope', () => {
  it('accepts the two office choices and rejects anything else', () => {
    expect(parseRecurringEditScope('occurrence')).toBe('occurrence');
    expect(parseRecurringEditScope(' future ')).toBe('future');
    expect(parseRecurringEditScope('')).toBeNull();
    expect(parseRecurringEditScope('all')).toBeNull();
  });
});

describe('planRecurringSeriesSplit', () => {
  it('keeps 10:00 local across the spring-forward boundary', () => {
    const march2 = at('2026-03-02T09:00');
    const march2End = at('2026-03-02T11:00');
    const march9 = at('2026-03-09T09:00');
    const march9End = at('2026-03-09T11:00');
    const editedStart = at('2026-03-02T10:00');
    const editedEnd = at('2026-03-02T12:00');

    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: march2,
      editedVisitId: 'v1',
      splitStartsAt: march2,
      editedStartsAt: editedStart,
      editedEndsAt: editedEnd,
      movedVisitIds: [],
      visits: [visit('v1', march2, march2End), visit('v2', march9, march9End)],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deactivateOldSeries).toBe(true);
    expect(plan.newRrule).toBe(WEEKLY);
    const shifted = plan.rewrites.find((row) => row.id === 'v2');
    expect(shifted?.preserveWindow).toBe(false);
    expect(zonedCivil(shifted?.startsAt ?? '', TZ)).toMatchObject({
      year: 2026,
      month: 3,
      day: 9,
      hour: 10,
      minute: 0,
    });
    expect(shifted?.startsAt).toBe('2026-03-09T14:00:00.000Z');
    expect(zonedCivil(shifted?.endsAt ?? '', TZ)?.hour).toBe(12);
    const utcDrift = seriesOccurrenceStarts({
      rruleDefinition: plan.newRrule,
      anchorStartsAt: plan.newAnchorStartsAt,
      from: new Date('2026-03-01T00:00:00.000Z'),
      until: new Date('2026-03-16T00:00:00.000Z'),
    });
    expect(utcDrift).toContain('2026-03-09T15:00:00.000Z');
    expect(plan.newSkips).toContain('2026-03-09T15:00:00.000Z');
  });

  it('keeps an overnight window across the spring-forward weekend', () => {
    const saturday = 'FREQ=WEEKLY;BYDAY=SA;INTERVAL=1';
    const first = at('2026-03-07T22:00');
    const firstEnd = at('2026-03-08T01:00');
    const next = at('2026-03-14T22:00');
    const nextEnd = at('2026-03-15T01:00');
    const editedStart = at('2026-03-07T22:30');
    const editedEnd = at('2026-03-08T01:30');

    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: saturday,
      anchorStartsAt: first,
      editedVisitId: 'night',
      splitStartsAt: first,
      editedStartsAt: editedStart,
      editedEndsAt: editedEnd,
      movedVisitIds: [],
      visits: [visit('night', first, firstEnd), visit('next', next, nextEnd)],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const shifted = plan.rewrites.find((row) => row.id === 'next');
    expect(zonedCivil(shifted?.startsAt ?? '', TZ)).toMatchObject({
      month: 3,
      day: 14,
      hour: 22,
      minute: 30,
    });
    expect(zonedCivil(shifted?.endsAt ?? '', TZ)).toMatchObject({
      month: 3,
      day: 15,
      hour: 1,
      minute: 30,
    });
    expect(plan.newDurationMinutes).toBe(180);
  });

  it('keeps an overnight window across the fall-back weekend', () => {
    const saturday = 'FREQ=WEEKLY;BYDAY=SA;INTERVAL=1';
    const first = at('2026-10-31T22:00');
    const firstEnd = at('2026-11-01T01:00');
    const next = at('2026-11-07T22:00');
    const nextEnd = at('2026-11-08T01:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: saturday,
      anchorStartsAt: first,
      editedVisitId: 'night',
      splitStartsAt: first,
      editedStartsAt: at('2026-10-31T22:00'),
      editedEndsAt: at('2026-11-01T01:00'),
      movedVisitIds: [],
      visits: [visit('night', first, firstEnd), visit('next', next, nextEnd)],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const shifted = plan.rewrites.find((row) => row.id === 'next');
    expect(zonedCivil(shifted?.startsAt ?? '', TZ)).toMatchObject({ hour: 22, minute: 0, day: 7 });
    expect(zonedCivil(shifted?.endsAt ?? '', TZ)).toMatchObject({ hour: 1, minute: 0, day: 8 });
  });

  it('turns the old series off when the split is the first occurrence', () => {
    const start = at('2026-06-01T09:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: start,
      editedVisitId: 'only',
      splitStartsAt: start,
      editedStartsAt: at('2026-06-01T10:00'),
      editedEndsAt: at('2026-06-01T12:00'),
      movedVisitIds: [],
      visits: [visit('only', start, at('2026-06-01T11:00'))],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deactivateOldSeries).toBe(true);
    expect(plan.kept).toEqual([]);
    expect(plan.rewrites).toHaveLength(1);
    const until = plan.oldRrule.split('UNTIL=')[1];
    expect(until).toBeTruthy();
    const generated = seriesOccurrenceStarts({
      rruleDefinition: plan.oldRrule,
      anchorStartsAt: start,
      from: new Date('2026-05-01T00:00:00.000Z'),
      until: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(generated).toEqual([]);
  });

  it('leaves earlier visits on the old series when the split is the last occurrence', () => {
    const first = at('2026-06-01T09:00');
    const last = at('2026-06-15T09:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: first,
      editedVisitId: 'last',
      splitStartsAt: last,
      editedStartsAt: at('2026-06-15T10:30'),
      editedEndsAt: at('2026-06-15T12:00'),
      movedVisitIds: [],
      visits: [
        visit('past', first, at('2026-06-01T11:00'), { status: 'completed', invoiced: true }),
        visit('middle', at('2026-06-08T09:00'), at('2026-06-08T11:00')),
        visit('last', last, at('2026-06-15T11:00')),
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.deactivateOldSeries).toBe(false);
    expect(plan.kept.map((row) => row.id).sort()).toEqual(['middle', 'past']);
    expect(plan.rewrites.map((row) => row.id)).toEqual(['last']);
    expect(plan.oldRrule.startsWith(`${WEEKLY};UNTIL=`)).toBe(true);
    expect(endSeriesBefore(WEEKLY, last)).toBe(plan.oldRrule);
  });

  it('keeps a moved future visit’s window and skips the Monday it replaced', () => {
    const june1 = at('2026-06-01T09:00');
    const june8 = at('2026-06-08T09:00');
    const moved = at('2026-06-17T13:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: june1,
      editedVisitId: 'this',
      splitStartsAt: june8,
      editedStartsAt: at('2026-06-08T10:00'),
      editedEndsAt: at('2026-06-08T12:00'),
      movedVisitIds: ['moved'],
      visits: [
        visit('past', june1, at('2026-06-01T11:00')),
        visit('this', june8, at('2026-06-08T11:00')),
        visit('later', at('2026-06-22T09:00'), at('2026-06-22T11:00')),
        visit('moved', moved, at('2026-06-17T15:00')),
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const exception = plan.rewrites.find((row) => row.id === 'moved');
    expect(exception).toMatchObject({
      preserveWindow: true,
      startsAt: new Date(moved).toISOString(),
    });
    const later = plan.rewrites.find((row) => row.id === 'later');
    expect(zonedCivil(later?.startsAt ?? '', TZ)).toMatchObject({ day: 22, hour: 10 });
    expect(plan.kept).toEqual([{ id: 'past', reason: 'before-split' }]);
    expect(plan.oldSkips).toContain(new Date(at('2026-06-15T09:00')).toISOString());
    expect(plan.newSkips.map((iso) => zonedCivil(iso, TZ)?.day)).toContain(15);
  });

  it('does not rewrite an invoiced future visit', () => {
    const start = at('2026-06-08T09:00');
    const later = at('2026-06-15T09:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: at('2026-06-01T09:00'),
      editedVisitId: 'this',
      splitStartsAt: start,
      editedStartsAt: at('2026-06-08T10:00'),
      editedEndsAt: at('2026-06-08T11:00'),
      movedVisitIds: [],
      visits: [
        visit('this', start, at('2026-06-08T11:00')),
        visit('billed', later, at('2026-06-15T11:00'), { invoiced: true, status: 'completed' }),
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.rewrites.map((row) => row.id)).toEqual(['this']);
    expect(plan.kept).toContainEqual({ id: 'billed', reason: 'protected' });
    expect(plan.newSkips.length).toBeGreaterThan(0);
  });

  it('moves a weekly series onto the edited weekday and a monthly series onto the edited day', () => {
    expect(openSeriesRrule(WEEKLY, at('2026-06-09T10:00'), TZ)).toBe(
      'FREQ=WEEKLY;BYDAY=TU;INTERVAL=1',
    );
    expect(
      openSeriesRrule('FREQ=MONTHLY;BYMONTHDAY=1;INTERVAL=1', at('2026-06-15T10:00'), TZ),
    ).toBe('FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1');

    const monday = at('2026-06-08T09:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: monday,
      editedVisitId: 'this',
      splitStartsAt: monday,
      editedStartsAt: at('2026-06-09T10:00'),
      editedEndsAt: at('2026-06-09T12:00'),
      movedVisitIds: [],
      visits: [
        visit('this', monday, at('2026-06-08T11:00')),
        visit('next', at('2026-06-15T09:00'), at('2026-06-15T11:00')),
      ],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.newRrule).toBe('FREQ=WEEKLY;BYDAY=TU;INTERVAL=1');
    const next = plan.rewrites.find((row) => row.id === 'next');
    expect(zonedCivil(next?.startsAt ?? '', TZ)).toMatchObject({ day: 16, hour: 10 });
  });

  it('clamps a monthly move onto short months instead of overflowing', () => {
    const rule = 'FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1';
    const cases = [
      { year: 2026, day: 31, feb: 28, apr: 30 },
      { year: 2026, day: 30, feb: 28, apr: 30 },
      { year: 2026, day: 29, feb: 28, apr: 29 },
      { year: 2028, day: 31, feb: 29, apr: 30 },
      { year: 2028, day: 30, feb: 29, apr: 30 },
      { year: 2028, day: 29, feb: 29, apr: 29 },
    ];
    for (const sample of cases) {
      const visits = [1, 2, 3, 4].map((month) => {
        const key = `${sample.year}-${String(month).padStart(2, '0')}`;
        return visit(`${key}`, at(`${key}-15T09:00`), at(`${key}-15T11:00`));
      });
      const editedDay = String(sample.day).padStart(2, '0');
      const plan = planRecurringSeriesSplit({
        timeZone: TZ,
        rruleDefinition: rule,
        anchorStartsAt: visits[0]!.startsAt,
        editedVisitId: visits[0]!.id,
        splitStartsAt: visits[0]!.startsAt,
        editedStartsAt: at(`${sample.year}-01-${editedDay}T09:00`),
        editedEndsAt: at(`${sample.year}-01-${editedDay}T11:00`),
        movedVisitIds: [],
        visits,
      });
      expect(plan.ok, `${sample.year} day ${sample.day}`).toBe(true);
      if (!plan.ok) continue;
      expect(plan.newRrule).toBe(`FREQ=MONTHLY;BYMONTHDAY=${sample.day};INTERVAL=1`);
      const local = plan.rewrites.map((row) => zonedCivil(row.startsAt, TZ));
      expect(local.map((row) => row && `${row.year}-${row.month}-${row.day}`)).toEqual([
        `${sample.year}-1-${sample.day}`,
        `${sample.year}-2-${sample.feb}`,
        `${sample.year}-3-${sample.day}`,
        `${sample.year}-4-${sample.apr}`,
      ]);
      expect(new Set(local.map((row) => row && `${row.year}-${row.month}`)).size).toBe(4);
      expect(clampMonthDay(sample.year, 2, sample.day)).toBe(sample.feb);
      expect(clampMonthDay(sample.year, 4, sample.day)).toBe(sample.apr);
    }
  });

  it('expands a day-31 rule onto the last day of February and April', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const until = new Date('2026-05-15T00:00:00.000Z');
    const starts = seriesOccurrenceStarts({
      rruleDefinition: 'FREQ=MONTHLY;BYMONTHDAY=31;INTERVAL=1',
      anchorStartsAt: at('2026-01-31T09:00'),
      from,
      until,
    }).map((iso) => zonedCivil(iso, TZ));
    expect(starts.map((row) => row && `${row.month}-${row.day}`)).toEqual([
      '1-31',
      '2-28',
      '3-31',
      '4-30',
    ]);

    const leap = seriesOccurrenceStarts({
      rruleDefinition: 'FREQ=MONTHLY;BYMONTHDAY=29;INTERVAL=1',
      anchorStartsAt: at('2028-01-29T09:00'),
      from: new Date('2028-01-01T00:00:00.000Z'),
      until: new Date('2028-04-01T00:00:00.000Z'),
    }).map((iso) => zonedCivil(iso, TZ)?.day);
    expect(leap).toEqual([29, 29, 29]);

    const nonLeap = seriesOccurrenceStarts({
      rruleDefinition: 'FREQ=MONTHLY;BYMONTHDAY=30;INTERVAL=1',
      anchorStartsAt: at('2026-01-30T09:00'),
      from,
      until,
    }).map((iso) => zonedCivil(iso, TZ)?.day);
    expect(nonLeap).toEqual([30, 28, 30, 30]);
  });

  it('refuses a split that would put two visits on one instant', () => {
    const start = at('2026-06-08T09:00');
    const plan = planRecurringSeriesSplit({
      timeZone: TZ,
      rruleDefinition: WEEKLY,
      anchorStartsAt: start,
      editedVisitId: 'a',
      splitStartsAt: start,
      editedStartsAt: at('2026-06-08T09:00'),
      editedEndsAt: at('2026-06-08T11:00'),
      movedVisitIds: ['b'],
      visits: [
        visit('a', start, at('2026-06-08T11:00')),
        visit('b', start, at('2026-06-08T12:00')),
      ],
    });
    expect(plan).toEqual({
      ok: false,
      error: 'Two visits in this series would land on the same time.',
    });
  });
});
