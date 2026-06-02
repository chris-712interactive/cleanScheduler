import { describe, expect, it } from 'vitest';
import { applyDurationToVisitWindow } from '@/lib/schedule/visitDuration';
import { computeNextWorkDayVisitWindow } from '@/lib/schedule/nextWorkDayVisitWindow';

describe('applyDurationToVisitWindow', () => {
  it('sets end time from duration', () => {
    const window = applyDurationToVisitWindow(
      { startsAt: '2026-06-02T13:00:00.000Z', endsAt: '2026-06-02T21:00:00.000Z' },
      4,
    );
    expect(new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime()).toBe(
      4 * 3_600_000,
    );
  });
});

describe('computeNextWorkDayVisitWindow with duration', () => {
  it('uses durationHours for visit end', () => {
    const now = new Date('2026-06-01T18:00:00.000Z');
    const window = computeNextWorkDayVisitWindow({
      timezone: 'America/New_York',
      workWeekDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      workDayStart: '09:00',
      workDayEnd: '17:00',
      now,
      durationHours: 3,
    });

    const durationMs = new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime();
    expect(durationMs).toBe(3 * 3_600_000);
  });
});
