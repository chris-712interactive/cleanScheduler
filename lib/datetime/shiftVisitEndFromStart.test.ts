import { describe, expect, it } from 'vitest';
import { shiftEndFromStartAndDuration } from './shiftVisitEndFromStart';

describe('shiftEndFromStartAndDuration', () => {
  it('adds duration hours to start in tenant timezone display', () => {
    const end = shiftEndFromStartAndDuration(
      '2026-06-01T09:00',
      2,
      'America/New_York',
      // EDT (UTC-4): browser offset must match the submitting client, not CI clock.
      240,
    );
    expect(end).toMatch(/^2026-06-01T11:00/);
  });
});
