import { describe, expect, it } from 'vitest';
import {
  defaultAutoScheduleVisitCount,
  isRecurringQuoteLineFrequency,
  parseAutoScheduleFlag,
  parseAutoScheduleVisitCount,
  resolveAutoScheduleVisitCount,
} from '@/lib/tenant/quoteLineAutoSchedule';

describe('quoteLineAutoSchedule helpers', () => {
  it('detects recurring frequencies', () => {
    expect(isRecurringQuoteLineFrequency('weekly')).toBe(true);
    expect(isRecurringQuoteLineFrequency('one_time')).toBe(false);
  });

  it('parses auto-schedule flags', () => {
    expect(parseAutoScheduleFlag('true')).toBe(true);
    expect(parseAutoScheduleFlag('false')).toBe(false);
    expect(parseAutoScheduleFlag('')).toBe(false);
  });

  it('defaults visit counts by cadence', () => {
    expect(defaultAutoScheduleVisitCount('weekly')).toBe(4);
    expect(defaultAutoScheduleVisitCount('one_time')).toBe(1);
  });

  it('parses and caps visit counts', () => {
    expect(parseAutoScheduleVisitCount('6', 'weekly')).toBe(6);
    expect(parseAutoScheduleVisitCount('99', 'weekly')).toBe(52);
    expect(parseAutoScheduleVisitCount('', 'weekly')).toBe(4);
  });

  it('resolves stored visit counts for recurring lines', () => {
    expect(resolveAutoScheduleVisitCount('one_time', 4)).toBe(1);
    expect(resolveAutoScheduleVisitCount('weekly', 3)).toBe(3);
    expect(resolveAutoScheduleVisitCount('weekly', null)).toBe(4);
  });
});
