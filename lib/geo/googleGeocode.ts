import type { GoogleLookupFailure } from '@/lib/geo/geocodeStatus';

type GeocodedPoint = {
  lat: number;
  lng: number;
};

export type GoogleLookup = { status: 'ok'; point: GeocodedPoint } | { status: GoogleLookupFailure };

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

/** First result from the Geocoding API, including the status when there is no point. */
export function googleLookupFromPayload(payload: unknown): GoogleLookup {
  if (typeof payload !== 'object' || payload === null) return { status: 'failed' };
  const body = payload as GoogleGeocodeResponse;
  if (body.status === 'OK') {
    const location = body.results?.[0]?.geometry?.location;
    const lat = location?.lat;
    const lng = location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return { status: 'failed' };
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { status: 'failed' };
    return { status: 'ok', point: { lat, lng } };
  }
  if (body.status === 'ZERO_RESULTS') return { status: 'no_match' };
  if (body.status === 'REQUEST_DENIED' || body.status === 'INVALID_REQUEST') {
    return { status: 'denied' };
  }
  if (body.status === 'OVER_QUERY_LIMIT' || body.status === 'OVER_DAILY_LIMIT') {
    return { status: 'quota' };
  }
  return { status: 'failed' };
}

/** First result from the Geocoding API. Non-OK statuses return null so the caller can fall back. */
export function pointFromGoogleGeocodeResponse(payload: unknown): GeocodedPoint | null {
  const lookup = googleLookupFromPayload(payload);
  return lookup.status === 'ok' ? lookup.point : null;
}

export function googleGeocodingApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
  return key || null;
}

/** Server-side Geocoding API. `skipped` when the key is missing. */
export async function geocodeWithGoogle(address: string): Promise<GoogleLookup> {
  const key = googleGeocodingApiKey();
  if (!key || address.length < 8) return { status: 'skipped' };

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'us');
  url.searchParams.set('key', key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { status: 'failed' };
    return googleLookupFromPayload(await response.json());
  } catch {
    return { status: 'failed' };
  }
}
