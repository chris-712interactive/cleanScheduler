import { describe, expect, it } from 'vitest';
import { donutArcs } from '@/lib/tenant/donutArcs';

describe('donutArcs', () => {
  it('returns nothing when every value is zero', () => {
    expect(donutArcs([0, 0])).toEqual([]);
  });

  it('gives one slice the whole circle', () => {
    expect(donutArcs([0, 4])).toEqual([{ lengthShare: 1, offsetShare: 0 }]);
  });

  it('splits the circle in the same order as the positive values', () => {
    expect(donutArcs([1, 0, 3])).toEqual([
      { lengthShare: 0.25, offsetShare: 0 },
      { lengthShare: 0.75, offsetShare: 0.25 },
    ]);
  });
});
