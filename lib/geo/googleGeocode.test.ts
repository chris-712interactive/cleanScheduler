import { describe, expect, it } from 'vitest';
import { resolveGeocodedPoint, sameGeocodeAddress } from '@/lib/geo/censusGeocode';
import { pointFromGoogleGeocodeResponse } from '@/lib/geo/googleGeocode';

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
    expect(point).toEqual({ lat: 35.37, lng: -83.22 });
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
