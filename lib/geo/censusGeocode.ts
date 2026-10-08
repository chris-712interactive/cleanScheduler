export type GeocodedPoint = {
  lat: number;
  lng: number;
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

export function formatGeocodeQuery(parts: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string {
  return [parts.line1, parts.city, parts.state, parts.postalCode]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ');
}

/**
 * US Census one-line geocoder. No API key. Returns null when the address
 * does not resolve or the service is unavailable, so a save can still succeed.
 */
export async function geocodeUsAddress(parts: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): Promise<GeocodedPoint | null> {
  const country = parts.country?.trim().toUpperCase();
  if (country && country !== 'US' && country !== 'USA' && country !== 'UNITED STATES') {
    return null;
  }
  const address = formatGeocodeQuery(parts);
  if (address.length < 8) return null;

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
