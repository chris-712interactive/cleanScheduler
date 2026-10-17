import { describe, expect, it } from 'vitest';
import {
  schedulingProfileScope,
  schedulesVisitKind,
  type MemberScheduleEligibility,
} from '@/lib/schedule/scheduleEligibility';

function member(overrides: Partial<MemberScheduleEligibility> = {}): MemberScheduleEligibility {
  return {
    role: 'admin',
    excludeFromJobs: false,
    excludeFromConsultations: false,
    ...overrides,
  };
}

describe('schedulesVisitKind', () => {
  it('lets a field employee take jobs and consultations', () => {
    const employee = member({ role: 'employee', excludeFromJobs: true });
    expect(schedulesVisitKind(employee, 'service')).toBe(true);
    expect(schedulesVisitKind(employee, 'consultation')).toBe(true);
  });

  it('keeps an office admin off the kinds they opted out of', () => {
    const office = member({ excludeFromJobs: true, excludeFromConsultations: true });
    expect(schedulesVisitKind(office, 'service')).toBe(false);
    expect(schedulesVisitKind(office, 'consultation')).toBe(false);
    expect(schedulesVisitKind(member({ excludeFromJobs: true }), 'consultation')).toBe(true);
  });
});

describe('schedulingProfileScope', () => {
  it('hides scheduling details only when both kinds are off', () => {
    expect(schedulingProfileScope(member())).toBe('full');
    expect(schedulingProfileScope(member({ excludeFromJobs: true }))).toBe('consultation');
    expect(
      schedulingProfileScope(member({ excludeFromJobs: true, excludeFromConsultations: true })),
    ).toBe('hidden');
    expect(schedulingProfileScope(member({ role: 'employee', excludeFromJobs: true }))).toBe(
      'full',
    );
  });
});
