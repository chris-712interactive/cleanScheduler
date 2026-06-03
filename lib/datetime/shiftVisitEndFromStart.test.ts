import { describe, expect, it } from 'vitest';
import { shiftEndFromStartAndDuration } from './shiftVisitEndFromStart';

describe('shiftEndFromStartAndDuration', () => {
  it('adds duration hours to start in tenant timezone display', () => {
    const end = shiftEndFromStartAndDuration(
      '2026-06-01T09:00',
      2,
      'America/New_York',
      new Date('2026-06-01T12:00:00-04:00').getTimezoneOffset(),
    );
    expect(end).toMatch(/^2026-06-01T11:00/);
  });
});
