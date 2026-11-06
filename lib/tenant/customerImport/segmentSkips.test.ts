import { describe, expect, it } from 'vitest';
import {
  formatSegmentSkipSummary,
  splitPropertiesForSegment,
} from '@/lib/tenant/customerImport/segmentSkips';
import { capabilitiesForSegment } from '@/lib/tenant/serviceSegment';

describe('splitPropertiesForSegment', () => {
  it('reports why a commercial address was skipped for a residential workspace', () => {
    const split = splitPropertiesForSegment(capabilitiesForSegment('residential'), [
      { kind: 'residential', label: 'Home' },
      { kind: 'commercial', label: 'Main office' },
    ]);
    expect(split.kept.map((property) => property.label)).toEqual(['Home']);
    expect(split.skipped).toEqual([
      {
        label: 'Main office',
        kind: 'commercial',
        reason: expect.stringMatching(/homes/i),
      },
    ]);
    expect(formatSegmentSkipSummary(split.skipped)).toMatch(/Skipped 1 address \(Main office\)/);
    expect(formatSegmentSkipSummary(split.skipped)).toMatch(/homes/i);
  });
});
