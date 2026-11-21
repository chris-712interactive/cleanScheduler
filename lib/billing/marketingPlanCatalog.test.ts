import { describe, expect, it } from 'vitest';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import {
  getMarketingFeatureBullets,
  ROUTING_COMPARISON_ROWS,
} from '@/lib/billing/marketingPlanCatalog';

describe('routing on the plan catalog', () => {
  it('lists each routing tool on the tiers that include it and nowhere else', () => {
    const starter = getMarketingFeatureBullets('starter');
    const business = getMarketingFeatureBullets('business');
    const pro = getMarketingFeatureBullets('pro');

    expect(starter).toContain('Day map of scheduled stops');
    expect(starter).toContain('Single-cleaner stop ordering');
    expect(starter).not.toContain('Multi-cleaner dispatch');
    expect(starter).not.toContain('Route re-optimization');
    expect(starter).not.toContain('Multiple start locations');
    expect(starter).not.toContain('Drive-time reports');

    expect(business).toContain('Day map of scheduled stops');
    expect(business).toContain('Single-cleaner stop ordering');
    expect(business).toContain('Multi-cleaner dispatch');
    expect(business).not.toContain('Route re-optimization');
    expect(business).not.toContain('Multiple start locations');
    expect(business).not.toContain('Drive-time reports');

    expect(pro).toContain('Multi-cleaner dispatch');
    expect(pro).toContain('Route re-optimization');
    expect(pro).toContain('Multiple start locations');
    expect(pro).toContain('Drive-time reports');
    expect(pro).toContain('Text packs after the monthly allowance: 1,000 for $15 or 2,500 for $35');

    for (const lines of [starter, business, pro]) {
      expect(lines.join('\n').toLowerCase()).not.toContain('add-on');
      expect(lines.join('\n').toLowerCase()).not.toContain('addon');
    }
  });

  it('feeds the comparison matrix from the same flags', () => {
    expect(ROUTING_COMPARISON_ROWS.map((row) => row.feature)).toEqual([
      'dayMap',
      'singleCleanerStopOrdering',
      'multiCleanerDispatch',
      'routeReoptimization',
      'multipleStartLocations',
      'driveTimeReports',
    ]);
    for (const row of ROUTING_COMPARISON_ROWS) {
      expect(PLATFORM_TIER_ENTITLEMENTS.starter.features[row.feature]).toBe(
        row.feature === 'dayMap' || row.feature === 'singleCleanerStopOrdering',
      );
      expect(PLATFORM_TIER_ENTITLEMENTS.business.features[row.feature]).toBe(
        row.feature === 'dayMap' ||
          row.feature === 'singleCleanerStopOrdering' ||
          row.feature === 'multiCleanerDispatch',
      );
      expect(PLATFORM_TIER_ENTITLEMENTS.pro.features[row.feature]).toBe(true);
    }
  });
});
