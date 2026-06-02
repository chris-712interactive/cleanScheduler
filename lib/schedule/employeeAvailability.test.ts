import { describe, expect, it } from 'vitest';
import { isVisitWithinMemberWorkWindow } from '@/lib/schedule/employeeAvailability';
import type { EffectiveMemberSchedule } from '@/lib/schedule/memberScheduleProfile';
import {
  effectiveDayWindowsFromMemberDays,
  validateMemberDayWindows,
} from '@/lib/tenant/memberAvailabilityDays';

describe('isVisitWithinMemberWorkWindow', () => {
  const schedule: EffectiveMemberSchedule = {
    userId: 'u1',
    timezone: 'America/New_York',
    dayWindows: {
      mon: { startsAt: '09:00', endsAt: '17:00' },
      tue: { startsAt: '09:00', endsAt: '17:00' },
      wed: { startsAt: '09:00', endsAt: '17:00' },
      thu: { startsAt: '09:00', endsAt: '17:00' },
      fri: { startsAt: '09:00', endsAt: '12:00' },
    },
  };

  it('accepts a visit fully inside work hours on a work day', () => {
    const ok = isVisitWithinMemberWorkWindow(
      schedule,
      '2026-06-02T14:00:00.000Z',
      '2026-06-02T16:00:00.000Z',
    );
    expect(ok).toBe(true);
  });

  it('rejects visits outside configured hours', () => {
    const ok = isVisitWithinMemberWorkWindow(
      schedule,
      '2026-06-02T22:00:00.000Z',
      '2026-06-02T23:00:00.000Z',
    );
    expect(ok).toBe(false);
  });

  it('uses per-day windows when they differ', () => {
    // 2026-06-05 is a Friday in America/New_York
    const okShortFriday = isVisitWithinMemberWorkWindow(
      schedule,
      '2026-06-05T15:00:00.000Z',
      '2026-06-05T15:30:00.000Z',
    );
    const okTooLateFriday = isVisitWithinMemberWorkWindow(
      schedule,
      '2026-06-05T17:00:00.000Z',
      '2026-06-05T18:00:00.000Z',
    );
    expect(okShortFriday).toBe(true);
    expect(okTooLateFriday).toBe(false);
  });
});

describe('memberAvailabilityDays helpers', () => {
  it('validates enabled day windows', () => {
    const error = validateMemberDayWindows([
      { weekday: 'mon', enabled: true, startsAt: '09:00', endsAt: '17:00' },
      { weekday: 'tue', enabled: false, startsAt: '09:00', endsAt: '17:00' },
    ]);
    expect(error).toBeNull();
  });

  it('builds effective day windows from member days', () => {
    const dayWindows = effectiveDayWindowsFromMemberDays([
      { weekday: 'mon', enabled: true, startsAt: '08:00', endsAt: '16:00' },
      { weekday: 'wed', enabled: true, startsAt: '10:00', endsAt: '14:00' },
      { weekday: 'fri', enabled: false, startsAt: '09:00', endsAt: '17:00' },
    ]);
    expect(dayWindows).toEqual({
      mon: { startsAt: '08:00', endsAt: '16:00' },
      wed: { startsAt: '10:00', endsAt: '14:00' },
    });
  });
});
