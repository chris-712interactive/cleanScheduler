import { describe, expect, it } from 'vitest';
import { mutationGate } from '@/lib/hosted-dev/mutationGate';

describe('hosted dev mutation gate', () => {
  it('stays blocked until the deployment confirms suppression', () => {
    expect(mutationGate({ outboundSuppressed: false })).toEqual({
      status: 'blocked',
      reason: expect.stringMatching(/OUTBOUND_SUPPRESSED/),
    });
    expect(mutationGate({ outboundSuppressed: true })).toEqual({ status: 'open' });
  });
});
