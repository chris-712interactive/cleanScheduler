import { afterEach, describe, expect, it, vi } from 'vitest';
import { censusLookupFromPayload } from './censusProvider';
import {
  addressGeocodeIsCurrent,
  lookupUsAddress,
  lookupWithProviders,
  resolveGeocodedPoint,
} from './censusGeocode';
import type { GeocodeProvider } from './geocodeProvider';
import { geocodioLookupFromPayload } from './geocodioProvider';
import type { ProviderLookup } from './geocodeProvider';
import censusMatch from './fixtures/census-match.json';
import censusNoMatch from './fixtures/census-no-match.json';
import geocodioMatch from './fixtures/geocodio-match.json';
import geocodioNoMatch from './fixtures/geocodio-no-match.json';

const address = {
  line1: '4600 Silver Hill Rd',
  city: 'Washington',
  state: 'DC',
  postalCode: '20233',
};

function provider(
  source: 'census' | 'geocodio',
  lookup: ProviderLookup,
): GeocodeProvider & { calls: number } {
  const state = { calls: 0 };
  return {
    source,
    calls: 0,
    async lookup() {
      state.calls += 1;
      this.calls = state.calls;
      return lookup;
    },
  };
}

describe('census and geocodio payload parsing', () => {
  it('reads a recorded Census match', () => {
    expect(censusLookupFromPayload(censusMatch)).toEqual({
      status: 'ok',
      hit: { lat: 38.845985, lng: -76.927487, accuracy: 'interpolated:L' },
    });
  });

  it('reads a recorded Census miss and a broken payload', () => {
    expect(censusLookupFromPayload(censusNoMatch).status).toBe('no_match');
    expect(censusLookupFromPayload({ result: {} }).status).toBe('failed');
    expect(censusLookupFromPayload(null).status).toBe('failed');
  });

  it('reads a recorded Geocodio match and miss', () => {
    expect(geocodioLookupFromPayload(geocodioMatch)).toEqual({
      status: 'ok',
      hit: { lat: 38.886672, lng: -77.094735, accuracy: 'rooftop' },
    });
    expect(geocodioLookupFromPayload(geocodioNoMatch).status).toBe('no_match');
    expect(geocodioLookupFromPayload({ error: 'Invalid API key' }).status).toBe('failed');
  });
});

describe('lookupWithProviders', () => {
  it('keeps the Census point and does not call Geocodio', async () => {
    const census = provider('census', {
      status: 'ok',
      hit: { lat: 38.84, lng: -76.92, accuracy: 'address' },
    });
    const geocodio = provider('geocodio', {
      status: 'ok',
      hit: { lat: 1, lng: 2, accuracy: 'rooftop' },
    });

    const result = await lookupWithProviders('4600 Silver Hill Rd', census, geocodio);

    expect(result).toMatchObject({
      point: { lat: 38.84, lng: -76.92 },
      source: 'census',
      accuracy: 'address',
      status: 'ok',
      reason: null,
    });
    expect(geocodio.calls).toBe(0);
  });

  it('uses Geocodio only after Census misses', async () => {
    const census = provider('census', { status: 'no_match' });
    const geocodio = provider('geocodio', {
      status: 'ok',
      hit: { lat: 38.88, lng: -77.09, accuracy: 'rooftop' },
    });

    const result = await lookupWithProviders('1109 N Highland St', census, geocodio);

    expect(result.source).toBe('geocodio');
    expect(result.point).toEqual({ lat: 38.88, lng: -77.09 });
    expect(census.calls).toBe(1);
    expect(geocodio.calls).toBe(1);
  });

  it('records a miss when both providers miss, and a failure when both throw', async () => {
    const missed = await lookupWithProviders(
      '1 Nowhere Lane',
      provider('census', { status: 'no_match' }),
      provider('geocodio', { status: 'no_match' }),
    );
    expect(missed).toMatchObject({
      point: null,
      reason: 'no_match',
      status: 'failed',
      source: null,
    });

    const thrown = await lookupWithProviders(
      '1 Nowhere Lane',
      {
        source: 'census',
        lookup() {
          throw new Error('down');
        },
      },
      null,
    );
    expect(thrown).toMatchObject({ point: null, reason: 'lookup_failed', status: 'pending' });
  });

  it('does not call Geocodio when no fallback is configured', async () => {
    const result = await lookupWithProviders(
      '1 Nowhere Lane',
      provider('census', { status: 'failed' }),
      null,
    );
    expect(result.reason).toBe('lookup_failed');
    expect(result.source).toBeNull();
  });
});

describe('address change detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEOCODIO_API_KEY;
  });

  it('does not call a provider when the address text is unchanged', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const stored = {
      line1: '10 Main St',
      city: 'Sylva',
      state: 'NC',
      postalCode: '28779',
      latitude: 35.37,
      longitude: -83.22,
      geocodeStatus: 'ok',
      geocodeSource: 'census' as const,
      geocodeAccuracy: 'address',
      geocodedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(
      addressGeocodeIsCurrent(
        { line1: '10 main st', city: 'Sylva', state: 'NC', postalCode: '28779' },
        stored,
      ),
    ).toBe(true);

    const result = await resolveGeocodedPoint(
      { line1: '10 main st', city: 'Sylva', state: 'NC', postalCode: '28779' },
      stored,
    );

    expect(result.reused).toBe(true);
    expect(result.point).toEqual({ lat: 35.37, lng: -83.22 });
    expect(result.source).toBe('census');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call a provider again after a failed attempt for the same address', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const previous = {
      line1: '10 Main St',
      city: 'Sylva',
      state: 'NC',
      postalCode: '28779',
      latitude: null,
      longitude: null,
      geocodeStatus: 'failed',
      geocodedAt: '2026-01-02T00:00:00.000Z',
      reason: 'no_match',
    };

    const result = await resolveGeocodedPoint(
      { line1: '10 Main St', city: 'Sylva', state: 'NC', postalCode: '28779' },
      previous,
    );

    expect(result.reused).toBe(true);
    expect(result.reason).toBe('no_match');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries an outage after the pause and does not call during it', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(censusMatch), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const previous = {
      ...address,
      latitude: null,
      longitude: null,
      geocodeStatus: 'failed',
      geocodedAt: '2026-04-01T00:00:00.000Z',
      reason: 'lookup_failed',
    };

    const during = await resolveGeocodedPoint(
      address,
      previous,
      undefined,
      Date.parse('2026-04-01T00:00:30.000Z'),
    );
    expect(during.reused).toBe(true);
    expect(during.status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();

    const later = await resolveGeocodedPoint(
      address,
      previous,
      undefined,
      Date.parse('2026-04-01T00:02:00.000Z'),
    );
    expect(later.reused).toBeFalsy();
    expect(later.point).toEqual({ lat: 38.845985, lng: -76.927487 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('looks up a changed address and survives a provider outage', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    const changed = await lookupUsAddress(address);
    expect(changed).toMatchObject({
      point: null,
      reason: 'lookup_failed',
      status: 'pending',
      reused: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(censusMatch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const matched = await lookupUsAddress({
      ...address,
      line1: '4600 Silver Hill Road',
    });
    expect(matched.point).toEqual({ lat: 38.845985, lng: -76.927487 });
    expect(matched.source).toBe('census');
    expect(matched.accuracy).toBe('interpolated:L');
  });
});
