import { describe, expect, it } from 'vitest';
import { shouldRecordRecurringOccurrenceSkip } from './recurringOccurrenceSkips';

describe('shouldRecordRecurringOccurrenceSkip', () => {
  it('records when a recurring visit moves to a new instant', () => {
    expect(
      shouldRecordRecurringOccurrenceSkip({
        recurringRuleId: 'rule-1',
        previousStartsAt: '2026-06-01T13:00:00.000Z',
        nextStartsAt: '2026-06-02T13:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('does not record for one-off visits', () => {
    expect(
      shouldRecordRecurringOccurrenceSkip({
        recurringRuleId: null,
        previousStartsAt: '2026-06-01T13:00:00.000Z',
        nextStartsAt: '2026-06-02T13:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('does not record when only end time changes', () => {
    expect(
      shouldRecordRecurringOccurrenceSkip({
        recurringRuleId: 'rule-1',
        previousStartsAt: '2026-06-01T13:00:00.000Z',
        nextStartsAt: '2026-06-01T13:00:00.000Z',
      }),
    ).toBe(false);
  });
});
