import { describe, expect, it } from 'vitest';
import { approximateTravelMinutes, normalizeUsState } from '@/lib/schedule/optimizer/geo';

describe('approximateTravelMinutes', () => {
  it('treats the same town as a short hop and another state as a long one', () => {
    const job = { point: null, city: 'Sarasota', state: 'FL', postalCode: '34236' };
    const neighbor = { point: null, city: 'Sarasota', state: 'Florida', postalCode: '34236' };
    const remote = { point: null, city: 'Columbus', state: 'OH', postalCode: '43215' };

    expect(approximateTravelMinutes(neighbor, job, 25)).toBe(15);
    expect(approximateTravelMinutes(remote, job, 25)).toBe(180);
  });

  it('reads full state names', () => {
    expect(normalizeUsState('Florida')).toBe('fl');
    expect(normalizeUsState('fl')).toBe('fl');
  });
});
