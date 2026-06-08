import { describe, expect, it } from 'vitest';
import { parseScheduleRole, SCHEDULE_ROLE_LABEL } from '@/lib/tenant/scheduleRoleLabels';

describe('parseScheduleRole', () => {
  it('accepts known roles', () => {
    expect(parseScheduleRole('initial')).toBe('initial');
    expect(parseScheduleRole('recurring')).toBe('recurring');
    expect(parseScheduleRole('standard')).toBe('standard');
  });

  it('rejects unknown values', () => {
    expect(parseScheduleRole('')).toBeNull();
    expect(parseScheduleRole('weekly')).toBeNull();
  });
});

describe('SCHEDULE_ROLE_LABEL', () => {
  it('has labels for every role', () => {
    expect(SCHEDULE_ROLE_LABEL.initial).toBeTruthy();
    expect(SCHEDULE_ROLE_LABEL.recurring).toBeTruthy();
    expect(SCHEDULE_ROLE_LABEL.standard).toBeTruthy();
  });
});
