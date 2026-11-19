import { censusGeocodeProvider, pointFromCensusResponse } from './censusProvider.ts';
import { geocodioApiKey, geocodioGeocodeProvider } from './geocodioProvider.ts';
import type { GeocodeReason } from './geocodeStatus.ts';
import type { GeocodeProvider, GeocodeSource, ProviderLookup } from './geocodeProvider.ts';

export { pointFromCensusResponse };

export type GeocodedPoint = {
  lat: number;
  lng: number;
};

export type GeocodeAddress = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type StoredGeocode = GeocodeAddress & {
  latitude: number | null;
  longitude: number | null;
  geocodeStatus?: string | null;
  geocodeSource?: GeocodeSource | null;
  geocodeAccuracy?: string | null;
  geocodedAt?: string | null;
  reason?: GeocodeReason | string | null;
};

export type GeocodeResult = {
  point: GeocodedPoint | null;
  reason: GeocodeReason | null;
  status?: 'ok' | 'failed' | 'pending' | null;
  source?: GeocodeSource | null;
  accuracy?: string | null;
  /** True when the stored attempt was kept and no provider was called. */
  reused?: boolean;
};

export type GeocodeDeps = {
  census?: GeocodeProvider;
  geocodio?: GeocodeProvider | null;
  env?: NodeJS.ProcessEnv;
};

function addressKey(parts: GeocodeAddress): string {
  const norm = (value?: string | null) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const country = norm(parts.country);
  return [
    norm(parts.line1),
    norm(parts.city),
    norm(parts.state),
    norm(parts.postalCode),
    country === 'usa' || country === 'united states' ? 'us' : country || 'us',
  ].join('|');
}

export function storedGeocodeSource(value: string | null | undefined): GeocodeSource | null {
  if (value === 'census' || value === 'geocodio') return value;
  return null;
}

export function sameGeocodeAddress(a: GeocodeAddress, b: GeocodeAddress): boolean {
  return addressKey(a) === addressKey(b);
}

export function formatGeocodeQuery(parts: GeocodeAddress): string {
  return [parts.line1, parts.city, parts.state, parts.postalCode]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

export function addressHasText(parts: GeocodeAddress): boolean {
  return [parts.line1, parts.city, parts.state, parts.postalCode].some(
    (part) => (part ?? '').trim().length > 0,
  );
}

/** Wait this long before another provider call after an outage. */
export const GEOCODE_OUTAGE_RETRY_MS = 60_000;

const TERMINAL_GEOCODE_REASONS = new Set([
  'no_match',
  'incomplete',
  'outside_us',
  'google_denied',
  'google_quota',
]);

/** A real miss stays put until the address changes. An outage does not. */
export function geocodeFailureIsTerminal(reason: string | null | undefined): boolean {
  return reason != null && TERMINAL_GEOCODE_REASONS.has(reason);
}

/** True when a recent outage should not call the provider again yet. */
export function geocodeOutageCoolingDown(
  geocodedAt: string | null | undefined,
  nowMs: number,
  retryAfterMs = GEOCODE_OUTAGE_RETRY_MS,
): boolean {
  if (!geocodedAt) return false;
  const then = Date.parse(geocodedAt);
  if (Number.isNaN(then)) return false;
  return nowMs - then < retryAfterMs;
}

/**
 * True when this address text should not be sent to a provider.
 * A point or a terminal miss (no match, incomplete, outside the US) stays.
 * An outage (`lookup_failed`) is tried again after GEOCODE_OUTAGE_RETRY_MS.
 */
export function addressGeocodeIsCurrent(
  next: GeocodeAddress,
  previous: StoredGeocode,
  nowMs = Date.now(),
): boolean {
  if (!sameGeocodeAddress(next, previous)) return false;
  if (!addressHasText(next)) return true;
  if (previous.latitude != null && previous.longitude != null) return true;
  if (previous.reason === 'lookup_failed') {
    return geocodeOutageCoolingDown(previous.geocodedAt, nowMs);
  }
  if (geocodeFailureIsTerminal(previous.reason)) return true;
  if (previous.geocodeStatus === 'failed' || previous.geocodeStatus === 'ok') return true;
  return false;
}

function failedResult(reason: GeocodeReason): GeocodeResult {
  return {
    point: null,
    reason,
    status: 'failed',
    source: null,
    accuracy: null,
    reused: false,
  };
}

function resultFromHit(
  source: GeocodeSource,
  hit: { lat: number; lng: number; accuracy: string | null },
): GeocodeResult {
  return {
    point: { lat: hit.lat, lng: hit.lng },
    reason: null,
    status: 'ok',
    source,
    accuracy: hit.accuracy,
    reused: false,
  };
}

/** Census first. Geocodio runs only when it is configured and Census did not match. */
export async function lookupWithProviders(
  address: string,
  census: GeocodeProvider,
  geocodio: GeocodeProvider | null,
): Promise<GeocodeResult> {
  let censusLookup: ProviderLookup;
  try {
    censusLookup = await census.lookup(address);
  } catch {
    censusLookup = { status: 'failed' };
  }
  if (censusLookup.status === 'ok') return resultFromHit(census.source, censusLookup.hit);

  let fallback: ProviderLookup | null = null;
  if (geocodio) {
    try {
      fallback = await geocodio.lookup(address);
    } catch {
      fallback = { status: 'failed' };
    }
    if (fallback.status === 'ok') return resultFromHit(geocodio.source, fallback.hit);
  }

  if (censusLookup.status === 'no_match' || fallback?.status === 'no_match') {
    return failedResult('no_match');
  }
  return {
    point: null,
    reason: 'lookup_failed',
    status: 'pending',
    source: null,
    accuracy: null,
    reused: false,
  };
}

function fallbackProvider(deps: GeocodeDeps | undefined): GeocodeProvider | null {
  if (deps && 'geocodio' in deps) return deps.geocodio ?? null;
  const key = geocodioApiKey(deps?.env);
  return key ? geocodioGeocodeProvider(key) : null;
}

/**
 * US Census geocoder, then Geocodio when `GEOCODIO_API_KEY` is set.
 * Google and Mapbox are not called: their terms forbid storing the results.
 * This function does not throw.
 */
export async function lookupUsAddress(
  parts: GeocodeAddress,
  deps?: GeocodeDeps,
): Promise<GeocodeResult> {
  try {
    const country = parts.country?.trim().toUpperCase();
    if (country && country !== 'US' && country !== 'USA' && country !== 'UNITED STATES') {
      return failedResult('outside_us');
    }
    const address = formatGeocodeQuery(parts);
    if (address.length < 8) {
      if (!addressHasText(parts)) {
        return {
          point: null,
          reason: null,
          status: null,
          source: null,
          accuracy: null,
          reused: false,
        };
      }
      return failedResult('incomplete');
    }
    const census = deps?.census ?? censusGeocodeProvider();
    return await lookupWithProviders(address, census, fallbackProvider(deps));
  } catch {
    return {
      point: null,
      reason: 'lookup_failed',
      status: 'pending',
      source: null,
      accuracy: null,
      reused: false,
    };
  }
}

/** Point only. Saves that do not show a reason can keep calling this. */
export async function geocodeUsAddress(parts: GeocodeAddress): Promise<GeocodedPoint | null> {
  return (await lookupUsAddress(parts)).point;
}

/**
 * Reuses a stored attempt when the address text is unchanged.
 * A changed address is looked up again. A miss includes a reason.
 */
export async function resolveGeocodedPoint(
  next: GeocodeAddress,
  previous: StoredGeocode | null,
  deps?: GeocodeDeps,
  nowMs = Date.now(),
): Promise<GeocodeResult> {
  if (previous && addressGeocodeIsCurrent(next, previous, nowMs)) {
    const hasPoint = previous.latitude != null && previous.longitude != null;
    const status = hasPoint
      ? 'ok'
      : previous.reason === 'lookup_failed'
        ? 'pending'
        : previous.geocodeStatus === 'failed'
          ? 'failed'
          : 'ok';
    return {
      point: hasPoint
        ? { lat: previous.latitude as number, lng: previous.longitude as number }
        : null,
      reason: hasPoint ? null : ((previous.reason as GeocodeReason | null) ?? null),
      status: addressHasText(next) ? status : null,
      source: previous.geocodeSource ?? null,
      accuracy: previous.geocodeAccuracy ?? null,
      reused: true,
    };
  }
  return lookupUsAddress(next, deps);
}
