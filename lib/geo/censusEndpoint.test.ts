import { afterEach, describe, expect, it, vi } from 'vitest';
import { censusGeocodeEndpoint, censusGeocodeProvider } from './censusProvider';

const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('censusGeocodeEndpoint', () => {
  it('keeps the Census URL when no override is set', () => {
    vi.stubEnv('CENSUS_GEOCODE_URL', '');
    expect(censusGeocodeEndpoint()).toBe(CENSUS);
  });

  it('uses a loopback http stub and ignores any other host', () => {
    vi.stubEnv('CENSUS_GEOCODE_URL', 'http://127.0.0.1:5499/geocoder/locations/onelineaddress');
    expect(censusGeocodeEndpoint()).toBe('http://127.0.0.1:5499/geocoder/locations/onelineaddress');
    vi.stubEnv('CENSUS_GEOCODE_URL', 'https://geocode.example.test/redirect');
    expect(censusGeocodeEndpoint()).toBe(CENSUS);
    vi.stubEnv('CENSUS_GEOCODE_URL', 'http://10.0.0.8/geocode');
    expect(censusGeocodeEndpoint()).toBe(CENSUS);
  });
});

describe('censusGeocodeProvider override', () => {
  it('requests the loopback stub instead of Census', async () => {
    vi.stubEnv('CENSUS_GEOCODE_URL', 'http://127.0.0.1:5499/geocoder/locations/onelineaddress');
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ result: { addressMatches: [] } }), { status: 200 });
    }) as typeof fetch;
    const result = await censusGeocodeProvider(fetchImpl).lookup('9 Nomatch Road, Asheville, NC');
    expect(result.status).toBe('no_match');
    expect(calls[0]).toContain('127.0.0.1:5499');
    expect(calls[0]).not.toContain('geo.census.gov');
  });
});
