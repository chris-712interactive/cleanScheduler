import { describe, expect, it } from 'vitest';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import {
  layoutVisitColumns,
  layoutVisitOnCalendarDay,
  resolveTimelineWindow,
} from './scheduleTimelineUtils';

describe('scheduleTimelineUtils tenant timezone layout', () => {
  const timeZone = 'America/Chicago';
  const dateKey = '2026-06-03';

  it('positions a 4pm–7pm visit on the matching hour lines', () => {
    const visit = {
      starts_at: parseTenantDatetimeLocalToIso(`${dateKey}T16:00`, timeZone)!,
      ends_at: parseTenantDatetimeLocalToIso(`${dateKey}T19:00`, timeZone)!,
    };
    const window = resolveTimelineWindow(dateKey, [visit], timeZone);
    const layout = layoutVisitOnCalendarDay(visit, dateKey, timeZone, window);

    expect(layout.visible).toBe(true);
    expect(window.startHour).toBeLessThanOrEqual(16);
    expect(window.endHour).toBeGreaterThanOrEqual(19);

    const slotStartMs = new Date(visit.starts_at).getTime();
    const slotEndMs = new Date(visit.ends_at).getTime();
    const windowStartMs = new Date(
      parseTenantDatetimeLocalToIso(
        `${dateKey}T${String(window.startHour).padStart(2, '0')}:00`,
        timeZone,
      )!,
    ).getTime();
    const windowEndMs = new Date(
      parseTenantDatetimeLocalToIso(
        `${dateKey}T${String(window.endHour).padStart(2, '0')}:00`,
        timeZone,
      )!,
    ).getTime();
    const totalMs = windowEndMs - windowStartMs;

    expect(layout.topPct).toBeCloseTo(((slotStartMs - windowStartMs) / totalMs) * 100, 1);
    expect(layout.heightPct).toBeCloseTo(((slotEndMs - slotStartMs) / totalMs) * 100, 1);
  });
});

describe('layoutVisitColumns', () => {
  it('puts two visits at the same time in adjacent columns', () => {
    const columns = layoutVisitColumns([
      { id: 'first', starts_at: '2026-10-06T14:00:00.000Z', ends_at: '2026-10-06T15:00:00.000Z' },
      { id: 'second', starts_at: '2026-10-06T14:00:00.000Z', ends_at: '2026-10-06T15:00:00.000Z' },
    ]);

    expect(columns.get('first')).toEqual({ column: 0, columnCount: 2 });
    expect(columns.get('second')).toEqual({ column: 1, columnCount: 2 });
  });

  it('keeps back-to-back visits in one column', () => {
    const columns = layoutVisitColumns([
      { id: 'morning', starts_at: '2026-10-06T14:00:00.000Z', ends_at: '2026-10-06T15:00:00.000Z' },
      {
        id: 'afternoon',
        starts_at: '2026-10-06T15:00:00.000Z',
        ends_at: '2026-10-06T16:00:00.000Z',
      },
    ]);

    expect(columns.get('morning')).toEqual({ column: 0, columnCount: 1 });
    expect(columns.get('afternoon')).toEqual({ column: 0, columnCount: 1 });
  });
});
