import { describe, expect, it } from 'vitest';
import { recentDuplicateSeriesId } from '@/lib/schedule/recentRecurringSeries';

const now = new Date('2026-06-01T12:00:00.000Z');

describe('recentDuplicateSeriesId', () => {
  it('matches the same repeat rule and anchor saved moments ago', () => {
    expect(
      recentDuplicateSeriesId(
        [
          {
            id: 'rule-1',
            created_at: '2026-06-01T11:59:30.000Z',
            rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
            anchor_starts_at: '2026-06-08T13:00:00.000Z',
          },
        ],
        {
          rruleDefinition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
          anchorStartsAt: '2026-06-08T13:00:00.000Z',
          now,
        },
      ),
    ).toBe('rule-1');
  });

  it('ignores an older series and a different time', () => {
    expect(
      recentDuplicateSeriesId(
        [
          {
            id: 'old',
            created_at: '2026-06-01T11:00:00.000Z',
            rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
            anchor_starts_at: '2026-06-08T13:00:00.000Z',
          },
          {
            id: 'other-time',
            created_at: '2026-06-01T11:59:30.000Z',
            rrule_definition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
            anchor_starts_at: '2026-06-08T15:00:00.000Z',
          },
        ],
        {
          rruleDefinition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
          anchorStartsAt: '2026-06-08T13:00:00.000Z',
          now,
        },
      ),
    ).toBeNull();
  });
});
