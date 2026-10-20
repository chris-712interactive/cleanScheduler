import { describe, expect, it } from 'vitest';
import { lookupUsAddress, resolveGeocodedPoint, sameGeocodeAddress } from '@/lib/geo/censusGeocode';
import { googleLookupFromPayload, pointFromGoogleGeocodeResponse } from '@/lib/geo/googleGeocode';

describe('pointFromGoogleGeocodeResponse', () => {
  it('reads the first result', () => {
    expect(
      pointFromGoogleGeocodeResponse({
        status: 'OK',
        results: [{ geometry: { location: { lat: 35.373, lng: -83.224 } } }],
      }),
    ).toEqual({ lat: 35.373, lng: -83.224 });
  });

  it('returns null when Google has no match', () => {
    expect(pointFromGoogleGeocodeResponse({ status: 'ZERO_RESULTS', results: [] })).toBeNull();
    expect(pointFromGoogleGeocodeResponse({ status: 'REQUEST_DENIED' })).toBeNull();
  });
});

describe('googleLookupFromPayload', () => {
  it('names the Google status that left the address without a point', () => {
    expect(googleLookupFromPayload({ status: 'ZERO_RESULTS', results: [] }).status).toBe(
      'no_match',
    );
    expect(googleLookupFromPayload({ status: 'REQUEST_DENIED' }).status).toBe('denied');
    expect(googleLookupFromPayload({ status: 'OVER_QUERY_LIMIT' }).status).toBe('quota');
  });
});

describe('resolveGeocodedPoint', () => {
  it('keeps the stored point when the address text is unchanged', async () => {
    const point = await resolveGeocodedPoint(
      { line1: '10 Main St', city: 'Sylva', state: 'NC', postalCode: '28779' },
      {
        line1: '10 Main St',
        city: 'Sylva',
        state: 'NC',
        postalCode: '28779',
        latitude: 35.37,
        longitude: -83.22,
      },
    );
    expect(point).toEqual({ point: { lat: 35.37, lng: -83.22 }, reason: null });
  });

  it('names a short address and an address outside the United States', async () => {
    await expect(lookupUsAddress({ line1: '1', city: '', state: 'NC' })).resolves.toEqual({
      point: null,
      reason: 'incomplete',
    });
    await expect(
      lookupUsAddress({
        line1: '10 King Street',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 2T6',
        country: 'CA',
      }),
    ).resolves.toEqual({ point: null, reason: 'outside_us' });
  });

  it('treats spacing and case as the same address', () => {
    expect(
      sameGeocodeAddress(
        { line1: '10 Main St', city: 'Sylva', state: 'NC' },
        { line1: '10 main st', city: ' sylva ', state: 'nc' },
      ),
    ).toBe(true);
  });
});
