import { describe, expect, it } from 'vitest';
import {
  buildEmployeeWeekDays,
  employeeWeekDateKeys,
  nextTimeOffOutsideWeek,
  timeOffLabelForDay,
} from '@/lib/schedule/employeeWeekSchedule';

const timeZone = 'America/New_York';

describe('employeeWeekDateKeys', () => {
  it('returns Monday through Sunday for a midweek anchor', () => {
    expect(employeeWeekDateKeys('2026-10-07')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

describe('timeOffLabelForDay', () => {
  it('shows the clock range when time off stays on one day', () => {
    expect(
      timeOffLabelForDay(
        { startsAt: '2026-06-02T13:00:00.000Z', endsAt: '2026-06-02T17:00:00.000Z' },
        '2026-06-02',
        timeZone,
      ),
    ).toBe('9:00 AM – 1:00 PM');
  });

  it('marks a middle day of a multi-day request as all day', () => {
    expect(
      timeOffLabelForDay(
        { startsAt: '2026-06-01T13:00:00.000Z', endsAt: '2026-06-03T17:00:00.000Z' },
        '2026-06-02',
        timeZone,
      ),
    ).toBe('All day');
  });
});

describe('buildEmployeeWeekDays', () => {
  it('places jobs and time off on the days they overlap', () => {
    const days = buildEmployeeWeekDays({
      weekDateKeys: ['2026-06-01', '2026-06-02'],
      todayKey: '2026-06-02',
      timeZone,
      visits: [
        {
          id: 'visit-1',
          startsAt: '2026-06-02T14:00:00.000Z',
          endsAt: '2026-06-02T16:00:00.000Z',
          title: 'Weekly clean',
          customerName: 'Vera Kendig',
        },
      ],
      timeOff: [
        {
          id: 'off-1',
          startsAt: '2026-06-02T13:00:00.000Z',
          endsAt: '2026-06-02T18:00:00.000Z',
          status: 'pending',
          note: 'Doctor',
        },
      ],
    });

    expect(days[0]?.blocks).toEqual([]);
    expect(days[1]?.isToday).toBe(true);
    expect(days[1]?.blocks.map((block) => block.kind)).toEqual(['time_off', 'visit']);
    expect(days[1]?.blocks[0]).toMatchObject({ status: 'pending', timeLabel: '9:00 AM – 2:00 PM' });
  });
});

describe('nextTimeOffOutsideWeek', () => {
  it('returns the next request that does not touch the visible week', () => {
    const week = employeeWeekDateKeys('2026-06-02');
    const next = nextTimeOffOutsideWeek(
      [
        {
          id: 'this-week',
          startsAt: '2026-06-02T13:00:00.000Z',
          endsAt: '2026-06-02T17:00:00.000Z',
          status: 'approved',
          note: '',
        },
        {
          id: 'later',
          startsAt: '2026-06-16T13:00:00.000Z',
          endsAt: '2026-06-16T17:00:00.000Z',
          status: 'pending',
          note: '',
        },
      ],
      week,
      timeZone,
    );
    expect(next?.id).toBe('later');
  });
});
