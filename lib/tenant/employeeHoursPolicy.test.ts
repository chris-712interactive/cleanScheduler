import { describe, expect, it } from 'vitest';
import { memberHoursSaveMode } from './employeeHoursPolicy';

const open: {
  employeesCanEditOwnHours: boolean;
  employeeHoursRequireApproval: boolean;
} = {
  employeesCanEditOwnHours: true,
  employeeHoursRequireApproval: false,
};

describe('memberHoursSaveMode', () => {
  it('saves a field employee change immediately when both switches are off', () => {
    expect(
      memberHoursSaveMode({
        actorRole: 'employee',
        editingSelf: true,
        ...open,
      }),
    ).toBe('immediate');
  });

  it('holds a field employee change until an admin approves it', () => {
    expect(
      memberHoursSaveMode({
        actorRole: 'employee',
        editingSelf: true,
        employeesCanEditOwnHours: true,
        employeeHoursRequireApproval: true,
      }),
    ).toBe('pending');
  });

  it('blocks a field employee when self-service hours are off', () => {
    expect(
      memberHoursSaveMode({
        actorRole: 'employee',
        editingSelf: true,
        employeesCanEditOwnHours: false,
        employeeHoursRequireApproval: true,
      }),
    ).toBe('locked');
  });

  it('lets an owner or admin save hours immediately', () => {
    expect(
      memberHoursSaveMode({
        actorRole: 'admin',
        editingSelf: true,
        employeesCanEditOwnHours: false,
        employeeHoursRequireApproval: true,
      }),
    ).toBe('immediate');
    expect(
      memberHoursSaveMode({
        actorRole: 'owner',
        editingSelf: false,
        employeesCanEditOwnHours: false,
        employeeHoursRequireApproval: true,
      }),
    ).toBe('immediate');
  });
});
