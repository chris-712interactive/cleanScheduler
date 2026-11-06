import { describe, expect, it } from 'vitest';
import { computeInstantSlots } from '@/lib/booking/computeInstantSlots';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import type { EffectiveMemberSchedule } from '@/lib/tenant/memberAvailabilityDays';

const TIMEZONE = 'America/New_York';

function atLocal(hour: number, minute = 0): string {
  const iso = localWallClockInTimeZoneToUtcIso(TIMEZONE, {
    year: 2026,
    month: 6,
    day: 3,
    hour,
    minute,
  });
  if (!iso) throw new Error('clock');
  return iso;
}

const crew = [
  {
    userId: 'crew-a',
    schedule: {
      userId: 'crew-a',
      timezone: TIMEZONE,
      dayWindows: {
        mon: { startsAt: '08:00', endsAt: '17:00' },
        tue: { startsAt: '08:00', endsAt: '17:00' },
        wed: { startsAt: '08:00', endsAt: '17:00' },
        thu: { startsAt: '08:00', endsAt: '17:00' },
        fri: { startsAt: '08:00', endsAt: '17:00' },
      },
    } satisfies EffectiveMemberSchedule,
  },
];

function slots(extra: Partial<Parameters<typeof computeInstantSlots>[0]> = {}) {
  return computeInstantSlots({
    timezone: TIMEZONE,
    workWeekDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workDayStart: '08:00',
    workDayEnd: '17:00',
    durationMinutes: 60,
    slotStepMinutes: 60,
    leadTimeHours: 0,
    windowDays: 1,
    bufferMinutes: 0,
    travelMph: 25,
    crew,
    busy: [],
    now: new Date(atLocal(7)),
    limit: 12,
    ...extra,
  });
}

describe('computeInstantSlots', () => {
  it('offers open times inside business hours', () => {
    const open = slots();
    expect(open[0]?.startsAt).toBe(atLocal(8));
    expect(open.some((slot) => slot.startsAt === atLocal(16))).toBe(true);
    expect(open.some((slot) => slot.assigneeUserId === 'crew-a')).toBe(true);
  });

  it('honors lead time', () => {
    const open = slots({ leadTimeHours: 3, now: new Date(atLocal(8)) });
    expect(
      open.every((slot) => new Date(slot.startsAt).getTime() >= new Date(atLocal(11)).getTime()),
    ).toBe(true);
  });

  it('keeps a buffer around an existing visit', () => {
    const open = slots({
      bufferMinutes: 30,
      busy: [
        {
          assigneeUserId: 'crew-a',
          startsAt: atLocal(9),
          endsAt: atLocal(10),
          kind: 'visit',
        },
      ],
    });
    const starts = open.map((slot) => slot.startsAt);
    expect(starts).not.toContain(atLocal(8));
    expect(starts).not.toContain(atLocal(9));
    expect(starts).not.toContain(atLocal(10));
    expect(starts).toContain(atLocal(11));
  });

  it('adds travel time between a visit and the new address', () => {
    const open = slots({
      bufferMinutes: 0,
      travelMph: 25,
      destination: {
        point: null,
        city: 'Naples',
        state: 'FL',
        postalCode: '34102',
      },
      busy: [
        {
          assigneeUserId: 'crew-a',
          startsAt: atLocal(9),
          endsAt: atLocal(10),
          kind: 'visit',
          place: {
            point: null,
            city: 'Tampa',
            state: 'FL',
            postalCode: '33602',
          },
        },
      ],
    });
    const starts = open.map((slot) => slot.startsAt);
    expect(starts).not.toContain(atLocal(11));
    expect(starts).toContain(atLocal(12));
  });

  it('skips approved time off', () => {
    const open = slots({
      busy: [
        {
          assigneeUserId: 'crew-a',
          startsAt: atLocal(8),
          endsAt: atLocal(12),
          kind: 'time_off',
        },
      ],
    });
    expect(open.map((slot) => slot.startsAt)).not.toContain(atLocal(8));
    expect(open.map((slot) => slot.startsAt)).toContain(atLocal(12));
  });
});
