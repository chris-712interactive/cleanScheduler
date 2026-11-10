import { describe, expect, it } from 'vitest';
import { mutationGate } from '@/lib/hosted-dev/mutationGate';

describe('hosted dev mutation gate', () => {
  it('always blocks writes and third-party transactions', () => {
    expect(mutationGate()).toEqual({
      status: 'blocked',
      reason: expect.stringMatching(/suppression/),
    });
  });
});
