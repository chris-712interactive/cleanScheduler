import { describe, expect, it } from 'vitest';
import {
  canBeScheduledAsCrew,
  canEditMemberAvailability,
  canEditTeamMember,
  canSetCrewSchedulingLimits,
} from '@/lib/tenant/employeePermissions';

describe('canEditMemberAvailability', () => {
  it('lets owners edit their own availability', () => {
    expect(
      canEditMemberAvailability({
        actor: 'owner',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        targetRole: 'owner',
      }),
    ).toBe(true);
  });

  it('lets admins edit their own availability', () => {
    expect(
      canEditMemberAvailability({
        actor: 'admin',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        targetRole: 'admin',
      }),
    ).toBe(true);
  });

  it('does not let viewers edit their own availability', () => {
    expect(
      canEditMemberAvailability({
        actor: 'viewer',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        targetRole: 'viewer',
      }),
    ).toBe(false);
  });

  it('still requires team management rights to edit others', () => {
    expect(
      canEditMemberAvailability({
        actor: 'admin',
        actorUserId: 'admin-1',
        targetUserId: 'employee-1',
        targetRole: 'employee',
      }),
    ).toBe(
      canEditTeamMember({
        actor: 'admin',
        actorUserId: 'admin-1',
        targetUserId: 'employee-1',
        targetRole: 'employee',
      }),
    );
  });
});

describe('canSetCrewSchedulingLimits', () => {
  it('lets the office set experience and daily caps', () => {
    expect(canSetCrewSchedulingLimits('owner')).toBe(true);
    expect(canSetCrewSchedulingLimits('admin')).toBe(true);
  });

  it('keeps field employees from setting their own caps', () => {
    expect(canSetCrewSchedulingLimits('employee')).toBe(false);
    expect(canSetCrewSchedulingLimits('viewer')).toBe(false);
  });
});

describe('canBeScheduledAsCrew', () => {
  it('includes owner, admin, and field employees', () => {
    expect(canBeScheduledAsCrew('owner')).toBe(true);
    expect(canBeScheduledAsCrew('admin')).toBe(true);
    expect(canBeScheduledAsCrew('employee')).toBe(true);
    expect(canBeScheduledAsCrew('viewer')).toBe(false);
  });
});
