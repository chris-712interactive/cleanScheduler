import {
  clipGeocodeAccuracy,
  pointInRange,
  type GeocodeProvider,
  type ProviderLookup,
} from './geocodeProvider';

type CensusMatch = {
  coordinates?: { x?: number; y?: number };
  tigerLine?: { side?: string };
  addressComponents?: { fromAddress?: string; toAddress?: string };
};

type CensusResponse = {
  result?: { addressMatches?: CensusMatch[] };
};

/** Match quality the Census locations API can actually tell us. */
export function accuracyFromCensusMatch(match: CensusMatch): string | null {
  const from = match.addressComponents?.fromAddress?.trim();
  const to = match.addressComponents?.toAddress?.trim();
  const side = match.tigerLine?.side?.trim();
  const kind = from && to && from !== to ? 'interpolated' : 'address';
  return clipGeocodeAccuracy(side ? `${kind}:${side}` : kind);
}

/** First Census match. Longitude is x and latitude is y. */
export function censusLookupFromPayload(payload: unknown): ProviderLookup {
  if (typeof payload !== 'object' || payload === null) return { status: 'failed' };
  const matches = (payload as CensusResponse).result?.addressMatches;
  if (!Array.isArray(matches)) return { status: 'failed' };
  const match = matches[0];
  if (!match) return { status: 'no_match' };
  const lng = match.coordinates?.x;
  const lat = match.coordinates?.y;
  if (typeof lat !== 'number' || typeof lng !== 'number') return { status: 'failed' };
  if (!pointInRange(lat, lng)) return { status: 'failed' };
  return {
    status: 'ok',
    hit: { lat, lng, accuracy: accuracyFromCensusMatch(match) },
  };
}

export function pointFromCensusResponse(payload: unknown): { lat: number; lng: number } | null {
  const lookup = censusLookupFromPayload(payload);
  return lookup.status === 'ok' ? { lat: lookup.hit.lat, lng: lookup.hit.lng } : null;
}

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export function censusGeocodeProvider(fetchImpl: typeof fetch = fetch): GeocodeProvider {
  return {
    source: 'census',
    async lookup(address: string): Promise<ProviderLookup> {
      const url = new URL(CENSUS_URL);
      url.searchParams.set('address', address);
      url.searchParams.set('benchmark', 'Public_AR_Current');
      url.searchParams.set('format', 'json');
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
        if (!response.ok) return { status: 'failed' };
        return censusLookupFromPayload(await response.json());
      } catch {
        return { status: 'failed' };
      }
    },
  };
}
