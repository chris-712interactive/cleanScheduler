import { describe, expect, it } from 'vitest';
import { parseRequiredCrewSize } from '@/lib/schedule/crewSize';

describe('parseRequiredCrewSize', () => {
  it('defaults a blank value to one cleaner', () => {
    expect(parseRequiredCrewSize('')).toEqual({ ok: true, size: 1 });
    expect(parseRequiredCrewSize(null)).toEqual({ ok: true, size: 1 });
  });

  it('accepts a whole number from 1 to 8', () => {
    expect(parseRequiredCrewSize('2')).toEqual({ ok: true, size: 2 });
    expect(parseRequiredCrewSize(8)).toEqual({ ok: true, size: 8 });
  });

  it('rejects fractions and numbers outside 1 to 8', () => {
    expect(parseRequiredCrewSize('0').ok).toBe(false);
    expect(parseRequiredCrewSize('9').ok).toBe(false);
    expect(parseRequiredCrewSize('1.5').ok).toBe(false);
  });
});
