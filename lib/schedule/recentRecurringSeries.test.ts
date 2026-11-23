import { describe, expect, it } from 'vitest';
import {
  recentDuplicateSeriesId,
  seriesCreateIdempotencyId,
} from '@/lib/schedule/recentRecurringSeries';

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

describe('seriesCreateIdempotencyId', () => {
  const input = {
    tenantId: 'tenant-1',
    customerId: 'cust-1',
    rruleDefinition: 'FREQ=WEEKLY;BYDAY=MO;INTERVAL=1',
    anchorStartsAt: '2026-06-08T13:00:00.000Z',
    now,
  };

  it('is stable for the same series inside one two-minute bucket', () => {
    const first = seriesCreateIdempotencyId(input);
    const second = seriesCreateIdempotencyId({
      ...input,
      now: new Date(now.getTime() + 30_000),
      anchorStartsAt: '2026-06-08T13:00:00Z',
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('changes when the series, the anchor, or the bucket changes', () => {
    const id = seriesCreateIdempotencyId(input);
    expect(seriesCreateIdempotencyId({ ...input, customerId: 'cust-2' })).not.toBe(id);
    expect(
      seriesCreateIdempotencyId({ ...input, anchorStartsAt: '2026-06-08T15:00:00.000Z' }),
    ).not.toBe(id);
    expect(
      seriesCreateIdempotencyId({ ...input, now: new Date(now.getTime() + 2 * 60 * 1000) }),
    ).not.toBe(id);
  });
});
