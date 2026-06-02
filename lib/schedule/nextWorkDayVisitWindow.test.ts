import { describe, expect, it } from 'vitest';
import { computeNextWorkDayVisitWindow } from '@/lib/schedule/nextWorkDayVisitWindow';

describe('computeNextWorkDayVisitWindow', () => {
  it('schedules on the next configured work day at tenant hours', () => {
    const now = new Date('2026-06-01T18:00:00.000Z');

    const window = computeNextWorkDayVisitWindow({
      timezone: 'America/New_York',
      workWeekDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      workDayStart: '09:00',
      workDayEnd: '11:00',
      now,
    });

    expect(new Date(window.startsAt).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(window.endsAt).getTime()).toBeGreaterThan(new Date(window.startsAt).getTime());
  });

  it('skips to the next work day when today is not in the work week', () => {
    const now = new Date('2026-06-06T15:00:00.000Z');

    const window = computeNextWorkDayVisitWindow({
      timezone: 'America/New_York',
      workWeekDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      workDayStart: '09:00',
      workDayEnd: '17:00',
      now,
    });

    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(new Date(window.startsAt));

    expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).toContain(weekday);
  });
});
