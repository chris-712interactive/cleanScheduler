import { describe, expect, it } from 'vitest';
import { geocodeReasonFromLookups, missingGeocodeMessage } from '@/lib/geo/geocodeStatus';

describe('geocodeReasonFromLookups', () => {
  it('keeps an actionable Google failure ahead of a Census miss', () => {
    expect(geocodeReasonFromLookups('denied', 'no_match')).toBe('google_denied');
    expect(geocodeReasonFromLookups('quota', 'failed')).toBe('google_quota');
  });

  it('says there was no match when either service answered that way', () => {
    expect(geocodeReasonFromLookups('no_match', 'no_match')).toBe('no_match');
    expect(geocodeReasonFromLookups('no_match', 'failed')).toBe('no_match');
    expect(geocodeReasonFromLookups('skipped', 'no_match')).toBe('no_match');
  });

  it('says the service did not respond when neither lookup answered', () => {
    expect(geocodeReasonFromLookups('failed', 'failed')).toBe('lookup_failed');
    expect(geocodeReasonFromLookups('skipped', 'failed')).toBe('lookup_failed');
  });
});

describe('missingGeocodeMessage', () => {
  it('stays quiet when the point is saved or the address is blank', () => {
    expect(
      missingGeocodeMessage({
        reason: 'no_match',
        latitude: 35.3,
        longitude: -83.2,
        addressParts: ['10 Main St'],
      }),
    ).toBeNull();
    expect(
      missingGeocodeMessage({
        reason: null,
        latitude: null,
        longitude: null,
        addressParts: ['', null],
      }),
    ).toBeNull();
  });

  it('includes the saved reason', () => {
    expect(
      missingGeocodeMessage({
        reason: 'no_match',
        latitude: null,
        longitude: null,
        addressParts: ['10 Main St', 'Sylva'],
      }),
    ).toBe('Missing map point. No map match. Check the street, city, state, and postal code.');
  });

  it('asks for another save when an older address has no reason yet', () => {
    expect(
      missingGeocodeMessage({
        reason: null,
        latitude: null,
        longitude: null,
        addressParts: ['10 Main St'],
      }),
    ).toBe('Missing map point. Save this address again to look it up.');
  });
});
