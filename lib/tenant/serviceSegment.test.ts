import { describe, expect, it } from 'vitest';
import {
  bookingServiceAllowed,
  capabilitiesForSegment,
  defaultPropertyKind,
  crewPropertyKindHelp,
  defaultRequestPropertyKind,
  mergeCrewPropertyKinds,
  savedQuoteJobType,
  parseServiceDirectorySegment,
  parseTenantServiceSegment,
  pricingPropertyKind,
  locationPropertyKindDeniedMessage,
  propertyKindAllowed,
  propertyKindSelectOptions,
  propertyKindWriteError,
  quoteLocationKindLock,
  propertyKindsForDirectorySegment,
  resolvePropertyKindWrite,
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

describe('commercial quote location kind', () => {
  it('names the service location when its saved type is outside the workspace', () => {
    const caps = capabilitiesForSegment('commercial');
    expect(locationPropertyKindDeniedMessage(caps, 'Main office', 'residential')).toBe(
      'Service location Main office is set to Residential; this workspace only serves commercial properties. Change its property type to Commercial.',
    );
    expect(locationPropertyKindDeniedMessage(caps, 'Lake house', 'short_term_rental')).toContain(
      'Short-term rental',
    );
  });

  it('keeps an allowed location locked and opens a disallowed one for correction', () => {
    const caps = capabilitiesForSegment('commercial');
    expect(quoteLocationKindLock({ locationKind: 'commercial', capabilities: caps })).toEqual({
      locked: true,
      disallowedKind: null,
    });
    expect(quoteLocationKindLock({ locationKind: 'residential', capabilities: caps })).toEqual({
      locked: false,
      disallowedKind: 'residential',
    });
    expect(
      quoteLocationKindLock({ locationKind: 'short_term_rental', capabilities: caps }),
    ).toEqual({
      locked: false,
      disallowedKind: 'short_term_rental',
    });
    expect(quoteLocationKindLock({ locationKind: null, capabilities: caps })).toEqual({
      locked: false,
      disallowedKind: null,
    });
  });

  it('defaults a new record to commercial only for a commercial workspace', () => {
    expect(defaultPropertyKind(capabilitiesForSegment('commercial'))).toBe('commercial');
    expect(defaultPropertyKind(capabilitiesForSegment('residential'))).toBe('residential');
    expect(defaultPropertyKind(capabilitiesForSegment('both'))).toBe('residential');
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

describe('grandfathered property kinds', () => {
  it('keeps the current kind in the select when the segment no longer offers it', () => {
    const options = propertyKindSelectOptions(capabilitiesForSegment('residential'), 'commercial');
    expect(options.map((option) => option.value)).toContain('commercial');
    expect(options.find((option) => option.value === 'commercial')?.outsideSegment).toBe(true);
  });

  it('does not change kind on a normal save', () => {
    const resolved = resolvePropertyKindWrite({
      capabilities: capabilitiesForSegment('residential'),
      postedKind: 'residential',
      existingKind: 'commercial',
      explicitChange: false,
    });
    expect(resolved).toEqual({ ok: true, kind: 'commercial' });
  });

  it('rejects an explicit change to a kind the workspace does not offer', () => {
    const resolved = resolvePropertyKindWrite({
      capabilities: capabilitiesForSegment('residential'),
      postedKind: 'commercial',
      existingKind: 'residential',
      explicitChange: true,
    });
    expect(resolved.ok).toBe(false);
  });

  it('allows an explicit change onto a kind the workspace does offer', () => {
    const resolved = resolvePropertyKindWrite({
      capabilities: capabilitiesForSegment('residential'),
      postedKind: 'residential',
      existingKind: 'commercial',
      explicitChange: true,
    });
    expect(resolved).toEqual({ ok: true, kind: 'residential' });
  });
});

describe('saved quote job type', () => {
  it('stores the selected location kind instead of the quote’s previous job type', () => {
    expect(
      savedQuoteJobType({
        locationKind: 'commercial',
        formKind: null,
        storedKind: 'residential',
      }),
    ).toBe('commercial');
    expect(
      savedQuoteJobType({
        locationKind: null,
        formKind: null,
        storedKind: 'residential',
      }),
    ).toBe('residential');
  });
});

describe('crew property kind help', () => {
  it('does not say every type is allowed when a hidden kind is kept', () => {
    expect(crewPropertyKindHelp(true)).toMatch(/does not allow every property type/);
    expect(crewPropertyKindHelp(false)).toMatch(/Leave these off to allow every property type/);
  });
});

describe('crew property kinds', () => {
  it('keeps hidden commercial skills and does not write an empty list', () => {
    const merged = mergeCrewPropertyKinds({
      capabilities: capabilitiesForSegment('residential'),
      submittedKinds: [],
      existingKinds: ['commercial'],
    });
    expect(merged).toEqual(['commercial']);
  });

  it('keeps a hidden kind when the visible boxes change', () => {
    const merged = mergeCrewPropertyKinds({
      capabilities: capabilitiesForSegment('residential'),
      submittedKinds: ['residential'],
      existingKinds: ['residential', 'commercial'],
    });
    expect(merged).toEqual(['residential', 'commercial']);
  });
});

describe('quote property kind', () => {
  it('uses the selected location instead of the manual property-type default', () => {
    expect(pricingPropertyKind({ locationKind: 'commercial', manualKind: 'residential' })).toBe(
      'commercial',
    );
    expect(pricingPropertyKind({ locationKind: null, manualKind: 'residential' })).toBe(
      'residential',
    );
    expect(
      sqftBidAllowedForProperty(
        capabilitiesForSegment('both'),
        pricingPropertyKind({ locationKind: 'commercial', manualKind: 'residential' }),
      ),
    ).toBe(true);
    expect(
      sqftBidAllowedForProperty(
        capabilitiesForSegment('both'),
        pricingPropertyKind({ locationKind: 'residential', manualKind: 'commercial' }),
      ),
    ).toBe(false);
  });
});

describe('customer location request default', () => {
  it('starts on the first allowed kind for a commercial-only company', () => {
    const kinds = [
      { value: 'commercial', label: 'Commercial' },
      { value: 'other', label: 'Other' },
    ];
    expect(defaultRequestPropertyKind(kinds, 'residential')).toBe('commercial');
    expect(defaultRequestPropertyKind(kinds, 'other')).toBe('other');
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
