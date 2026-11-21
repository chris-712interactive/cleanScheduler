import { describe, expect, it } from 'vitest';
import { DAILY_JOB_CAP_ERROR, parseDailyJobCap } from '@/lib/schedule/dailyJobCap';

describe('parseDailyJobCap', () => {
  it('treats a blank value as no cap', () => {
    expect(parseDailyJobCap('')).toEqual({ ok: true, value: null });
    expect(parseDailyJobCap('   ')).toEqual({ ok: true, value: null });
    expect(parseDailyJobCap(null)).toEqual({ ok: true, value: null });
  });

  it('rejects 0 because blank is the only way to mean no cap', () => {
    expect(parseDailyJobCap('0')).toEqual({ ok: false, error: DAILY_JOB_CAP_ERROR });
  });

  it('rejects -1', () => {
    expect(parseDailyJobCap('-1')).toEqual({ ok: false, error: DAILY_JOB_CAP_ERROR });
  });

  it('rejects 21', () => {
    expect(parseDailyJobCap('21')).toEqual({ ok: false, error: DAILY_JOB_CAP_ERROR });
  });

  it('accepts 5', () => {
    expect(parseDailyJobCap('5')).toEqual({ ok: true, value: 5 });
  });
});
