import { describe, expect, it } from 'vitest';
import { shouldAutoConfirmTrialOwnerEmail } from '@/lib/auth/emailConfirmMode';

describe('emailConfirmMode', () => {
  it('always auto-confirms free-trial workspace owners', () => {
    expect(shouldAutoConfirmTrialOwnerEmail()).toBe(true);
  });
});
