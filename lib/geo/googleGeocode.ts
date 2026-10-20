type GeocodedPoint = {
  lat: number;
  lng: number;
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

/** First result from the Geocoding API. Non-OK statuses return null so the caller can fall back. */
export function pointFromGoogleGeocodeResponse(payload: unknown): GeocodedPoint | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as GoogleGeocodeResponse;
  if (body.status !== 'OK') return null;
  const location = body.results?.[0]?.geometry?.location;
  const lat = location?.lat;
  const lng = location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function googleGeocodingApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
  return key || null;
}

/** Server-side Geocoding API. Returns null when the key is missing or the lookup does not resolve. */
export async function geocodeWithGoogle(address: string): Promise<GeocodedPoint | null> {
  const key = googleGeocodingApiKey();
  if (!key || address.length < 8) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'us');
  url.searchParams.set('key', key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return pointFromGoogleGeocodeResponse(await response.json());
  } catch {
    return null;
  }
}
