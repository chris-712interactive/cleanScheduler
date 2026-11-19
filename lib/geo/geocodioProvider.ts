import {
  clipGeocodeAccuracy,
  pointInRange,
  type GeocodeProvider,
  type ProviderLookup,
} from './geocodeProvider';

type GeocodioResult = {
  location?: { lat?: number; lng?: number };
  accuracy?: number;
  accuracy_type?: string;
};

type GeocodioResponse = {
  results?: GeocodioResult[];
  error?: string;
};

/** Optional fallback. Absent unless GEOCODIO_API_KEY is set to a non-blank value. */
export function geocodioApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.GEOCODIO_API_KEY?.trim();
  return key || null;
}

export function geocodioLookupFromPayload(payload: unknown): ProviderLookup {
  if (typeof payload !== 'object' || payload === null) return { status: 'failed' };
  const body = payload as GeocodioResponse;
  if (typeof body.error === 'string' && body.error.trim()) return { status: 'failed' };
  if (!Array.isArray(body.results)) return { status: 'failed' };
  const first = body.results[0];
  if (!first) return { status: 'no_match' };
  const lat = first.location?.lat;
  const lng = first.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return { status: 'failed' };
  if (!pointInRange(lat, lng)) return { status: 'failed' };
  const accuracy =
    typeof first.accuracy_type === 'string' && first.accuracy_type.trim()
      ? first.accuracy_type
      : typeof first.accuracy === 'number'
        ? String(first.accuracy)
        : null;
  return { status: 'ok', hit: { lat, lng, accuracy: clipGeocodeAccuracy(accuracy) } };
}

export function geocodioGeocodeProvider(
  key: string,
  fetchImpl: typeof fetch = fetch,
): GeocodeProvider {
  return {
    source: 'geocodio',
    async lookup(address: string): Promise<ProviderLookup> {
      const url = new URL('https://api.geocod.io/v1.7/geocode');
      url.searchParams.set('q', address);
      url.searchParams.set('api_key', key);
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return { status: 'failed' };
        return geocodioLookupFromPayload(await response.json());
      } catch {
        return { status: 'failed' };
      }
    },
  };
}
