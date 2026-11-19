import type { GeocodeResult } from './censusGeocode.ts';
import type { GeocodeSource } from './geocodeProvider.ts';

export type PropertyGeocodeStatus = 'pending' | 'ok' | 'failed';

export type PropertyGeocodePatch = {
  latitude: number | null;
  longitude: number | null;
  geocode_reason: string | null;
  geocode_status: PropertyGeocodeStatus | null;
  geocode_source: GeocodeSource | null;
  geocode_accuracy: string | null;
  geocoded_at: string | null;
};

export const BLANK_PROPERTY_GEOCODE: PropertyGeocodePatch = {
  latitude: null,
  longitude: null,
  geocode_reason: null,
  geocode_status: null,
  geocode_source: null,
  geocode_accuracy: null,
  geocoded_at: null,
};

/** Written with the address so a crashed lookup can be retried by the backfill. */
export const PENDING_PROPERTY_GEOCODE: PropertyGeocodePatch = {
  latitude: null,
  longitude: null,
  geocode_reason: null,
  geocode_status: 'pending',
  geocode_source: null,
  geocode_accuracy: null,
  geocoded_at: null,
};

export function propertyGeocodePatchFromResult(
  result: GeocodeResult,
  recordedAt: string,
): PropertyGeocodePatch {
  const status =
    result.reason === 'lookup_failed' && !result.point
      ? 'pending'
      : result.status === 'pending' || result.status === 'ok' || result.status === 'failed'
        ? result.status
        : result.point
          ? 'ok'
          : result.reason
            ? 'failed'
            : null;
  return {
    latitude: result.point?.lat ?? null,
    longitude: result.point?.lng ?? null,
    geocode_reason: result.reason,
    geocode_status: status,
    geocode_source: result.source ?? null,
    geocode_accuracy: result.accuracy ?? null,
    geocoded_at: status == null ? null : recordedAt,
  };
}
