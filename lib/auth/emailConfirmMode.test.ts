import { describe, expect, it } from 'vitest';
import {
  shouldAutoConfirmCustomerPortalInviteEmail,
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

  it('always auto-confirms customer portal invites', () => {
    expect(shouldAutoConfirmCustomerPortalInviteEmail()).toBe(true);
  });
});
