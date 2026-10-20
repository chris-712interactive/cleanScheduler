import { geocodeWithGoogle } from '@/lib/geo/googleGeocode';

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
};

type CensusMatch = {
  coordinates?: { x?: number; y?: number };
};

type CensusResponse = {
  result?: { addressMatches?: CensusMatch[] };
};

/** Pulls the first Census match. Longitude is x, latitude is y. */
export function pointFromCensusResponse(payload: unknown): GeocodedPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const matches = (payload as CensusResponse).result?.addressMatches;
  const coordinates = matches?.[0]?.coordinates;
  const lng = coordinates?.x;
  const lat = coordinates?.y;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function formatGeocodeQuery(parts: GeocodeAddress): string {
  return [parts.line1, parts.city, parts.state, parts.postalCode]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

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

export function sameGeocodeAddress(a: GeocodeAddress, b: GeocodeAddress): boolean {
  return addressKey(a) === addressKey(b);
}

async function geocodeWithCensus(address: string): Promise<GeocodedPoint | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return pointFromCensusResponse(await response.json());
  } catch {
    return null;
  }
}

/**
 * Google Geocoding API when `GOOGLE_MAPS_GEOCODING_API_KEY` is set, then the
 * US Census geocoder. Returns null when the address does not resolve, so a
 * save can still succeed.
 */
export async function geocodeUsAddress(parts: GeocodeAddress): Promise<GeocodedPoint | null> {
  const country = parts.country?.trim().toUpperCase();
  if (country && country !== 'US' && country !== 'USA' && country !== 'UNITED STATES') {
    return null;
  }
  const address = formatGeocodeQuery(parts);
  if (address.length < 8) return null;

  const google = await geocodeWithGoogle(address);
  if (google) return google;
  return geocodeWithCensus(address);
}

/**
 * Reuses a stored point when the address text is unchanged.
 * A cleared address returns null. A changed address is looked up again.
 */
export async function resolveGeocodedPoint(
  next: GeocodeAddress,
  previous: StoredGeocode | null,
): Promise<GeocodedPoint | null> {
  if (formatGeocodeQuery(next).length < 8) return null;
  if (
    previous &&
    sameGeocodeAddress(next, previous) &&
    previous.latitude != null &&
    previous.longitude != null
  ) {
    return { lat: previous.latitude, lng: previous.longitude };
  }
  return geocodeUsAddress(next);
}
