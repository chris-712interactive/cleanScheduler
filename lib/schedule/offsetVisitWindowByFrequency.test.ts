import { describe, expect, it } from 'vitest';
import { offsetVisitWindowByFrequency } from '@/lib/schedule/offsetVisitWindowByFrequency';

describe('offsetVisitWindowByFrequency', () => {
  const base = {
    startsAt: '2026-06-02T13:00:00.000Z',
    endsAt: '2026-06-02T15:00:00.000Z',
  };

  it('returns the same window for sequence zero', () => {
    expect(offsetVisitWindowByFrequency(base, 0, 'weekly')).toEqual(base);
  });

  it('offsets weekly visits by seven days per sequence', () => {
    const shifted = offsetVisitWindowByFrequency(base, 2, 'weekly');
    const deltaDays =
      (new Date(shifted.startsAt).getTime() - new Date(base.startsAt).getTime()) / 86_400_000;
    expect(deltaDays).toBe(14);
  });

  it('does not offset one-time visits', () => {
    expect(offsetVisitWindowByFrequency(base, 3, 'one_time')).toEqual(base);
  });
});
