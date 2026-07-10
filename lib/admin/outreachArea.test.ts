import { describe, expect, it } from 'vitest';
import { formatOutreachArea, summarizeOutreachAreas } from '@/lib/admin/outreachArea';

describe('formatOutreachArea', () => {
  it('formats city, county, and state', () => {
    expect(formatOutreachArea({ city: 'Naples', county: 'Collier', state: 'FL' })).toBe(
      'Naples, Collier County, FL',
    );
  });

  it('falls back when parts are missing', () => {
    expect(formatOutreachArea({ city: 'Fort Myers', state: 'FL' })).toBe('Fort Myers, FL');
    expect(formatOutreachArea({})).toBe('—');
  });
});

describe('summarizeOutreachAreas', () => {
  it('counts by county and state', () => {
    const summary = summarizeOutreachAreas([
      { county: 'Lee', state: 'FL' },
      { county: 'Lee', state: 'FL' },
      { county: 'Collier', state: 'FL' },
    ]);
    expect(summary[0]).toEqual({ label: 'Lee County, FL', count: 2 });
    expect(summary[1]).toEqual({ label: 'Collier County, FL', count: 1 });
  });
});
