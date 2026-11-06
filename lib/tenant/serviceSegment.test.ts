import { describe, expect, it } from 'vitest';
import {
  bookingServiceAllowed,
  capabilitiesForSegment,
  defaultPropertyKind,
  parseServiceDirectorySegment,
  parseTenantServiceSegment,
  propertyKindAllowed,
  propertyKindWriteError,
  propertyKindsForDirectorySegment,
  sqftBidAllowedForProperty,
} from '@/lib/tenant/serviceSegment';

describe('parseTenantServiceSegment', () => {
  it('keeps the three settings', () => {
    expect(parseTenantServiceSegment('residential')).toBe('residential');
    expect(parseTenantServiceSegment('commercial')).toBe('commercial');
    expect(parseTenantServiceSegment('both')).toBe('both');
  });

  it('defaults unknown values to both so existing workspaces do not lose a service line', () => {
    expect(parseTenantServiceSegment('')).toBe('both');
    expect(parseTenantServiceSegment(null)).toBe('both');
    expect(parseTenantServiceSegment('mixed cleaning')).toBe('both');
  });
});

describe('capabilitiesForSegment', () => {
  it('hides commercial property types, bids, and office presets for residential workspaces', () => {
    const caps = capabilitiesForSegment('residential');
    expect(caps.offersCommercial).toBe(false);
    expect(caps.showBedsBaths).toBe(true);
    expect(caps.sqftBids).toBe(false);
    expect(caps.propertyKinds).toEqual(['residential', 'short_term_rental', 'other']);
    expect(caps.pricingMethods.map((option) => option.value)).not.toContain('per_sqft');
    expect(caps.scopeTemplates.map((template) => template.id)).not.toContain('commercial_office');
    expect(caps.addons.length).toBeGreaterThan(0);
    expect(caps.schedulePresets).not.toContain('commercial_sites');
    expect(caps.bookingServices.map((option) => option.value)).not.toContain('Office / commercial');
    expect(caps.consultationGroups).not.toContain('commercial');
  });

  it('hides beds, baths, and maid presets for commercial workspaces', () => {
    const caps = capabilitiesForSegment('commercial');
    expect(caps.offersResidential).toBe(false);
    expect(caps.showBedsBaths).toBe(false);
    expect(caps.showSqft).toBe(true);
    expect(caps.sqftBids).toBe(true);
    expect(propertyKindAllowed(caps, 'residential')).toBe(false);
    expect(propertyKindAllowed(caps, 'commercial')).toBe(true);
    expect(caps.scopeTemplates.map((template) => template.id)).not.toContain(
      'residential_standard',
    );
    expect(caps.addons).toEqual([]);
    expect(caps.schedulePresets).not.toContain('residential_routes');
    expect(caps.bookingServices.map((option) => option.value)).toContain('Recurring janitorial');
    expect(caps.bookingServices.map((option) => option.value)).not.toContain('Standard clean');
    expect(defaultPropertyKind(caps)).toBe('commercial');
  });

  it('keeps both lines and distinguishes them for mixed workspaces', () => {
    const caps = capabilitiesForSegment('both');
    expect(caps.offersBoth).toBe(true);
    expect(caps.propertyKinds).toContain('residential');
    expect(caps.propertyKinds).toContain('commercial');
    expect(caps.pricingMethods.map((option) => option.value)).toContain('per_sqft');
    expect(caps.scopeTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining(['residential_standard', 'commercial_office']),
    );
  });
});

describe('property kind writes', () => {
  it('rejects a commercial location on a residential workspace', () => {
    const caps = capabilitiesForSegment('residential');
    expect(propertyKindWriteError(caps, 'commercial')).toMatch(/homes/i);
  });

  it('still allows saving a location that was already outside the segment', () => {
    const caps = capabilitiesForSegment('residential');
    expect(propertyKindWriteError(caps, 'commercial', 'commercial')).toBeNull();
  });
});

describe('square-foot bid gate', () => {
  it('requires a commercial segment and a commercial property', () => {
    expect(sqftBidAllowedForProperty(capabilitiesForSegment('commercial'), 'commercial')).toBe(
      true,
    );
    expect(sqftBidAllowedForProperty(capabilitiesForSegment('both'), 'residential')).toBe(false);
    expect(sqftBidAllowedForProperty(capabilitiesForSegment('residential'), 'commercial')).toBe(
      false,
    );
  });
});

describe('booking services', () => {
  it('rejects an office request for a residential company', () => {
    const caps = capabilitiesForSegment('residential');
    expect(bookingServiceAllowed(caps, 'Office / commercial')).toBe(false);
    expect(bookingServiceAllowed(caps, 'Standard clean')).toBe(true);
    expect(bookingServiceAllowed(caps, '')).toBe(true);
  });
});

describe('directory segments', () => {
  it('maps tabs to property kinds', () => {
    expect(parseServiceDirectorySegment('commercial')).toBe('commercial');
    expect(propertyKindsForDirectorySegment('residential')).toEqual([
      'residential',
      'short_term_rental',
    ]);
    expect(propertyKindsForDirectorySegment('all')).toBeNull();
  });
});
