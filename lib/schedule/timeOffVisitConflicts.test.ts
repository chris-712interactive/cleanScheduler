import { describe, expect, it } from 'vitest';
import { assigneeHasOverlappingTimeOff } from '@/lib/schedule/timeOffVisitConflicts';

const timeOff = [
  {
    userId: 'crew',
    startsAt: '2026-06-02T13:00:00.000Z',
    endsAt: '2026-06-02T21:00:00.000Z',
  },
];

describe('assigneeHasOverlappingTimeOff', () => {
  it('flags a visit assigned to someone who is off during that window', () => {
    expect(
      assigneeHasOverlappingTimeOff(
        ['crew'],
        '2026-06-02T14:00:00.000Z',
        '2026-06-02T16:00:00.000Z',
        timeOff,
      ),
    ).toBe(true);
  });

  it('ignores time off for a different assignee', () => {
    expect(
      assigneeHasOverlappingTimeOff(
        ['other'],
        '2026-06-02T14:00:00.000Z',
        '2026-06-02T16:00:00.000Z',
        timeOff,
      ),
    ).toBe(false);
  });

  it('ignores a visit that ends when time off starts', () => {
    expect(
      assigneeHasOverlappingTimeOff(
        ['crew'],
        '2026-06-02T12:00:00.000Z',
        '2026-06-02T13:00:00.000Z',
        timeOff,
      ),
    ).toBe(false);
  });
});
