/**
 * Response parser kept for older Google payloads.
 * Do not store Google or Mapbox geocodes. Their terms forbid keeping the results.
 * Service locations use the Census geocoder, then Geocodio when GEOCODIO_API_KEY is set.
 */
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
