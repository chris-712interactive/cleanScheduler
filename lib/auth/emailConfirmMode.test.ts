import { describe, expect, it } from 'vitest';
import {
  shouldAutoConfirmInvitedEmployeeEmail,
  shouldAutoConfirmTrialOwnerEmail,
} from '@/lib/auth/emailConfirmMode';

describe('emailConfirmMode', () => {
  it('always auto-confirms free-trial workspace owners', () => {
    expect(shouldAutoConfirmTrialOwnerEmail()).toBe(true);
  });

  it('always auto-confirms invited employees', () => {
    expect(shouldAutoConfirmInvitedEmployeeEmail()).toBe(true);
  });
});
