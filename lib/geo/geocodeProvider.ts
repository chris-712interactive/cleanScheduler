export const GEOCODE_SOURCES = ['census', 'geocodio'] as const;

export type GeocodeSource = (typeof GEOCODE_SOURCES)[number];

export type GeocodeHit = {
  lat: number;
  lng: number;
  accuracy: string | null;
};

export type ProviderLookup =
  { status: 'ok'; hit: GeocodeHit } | { status: 'no_match' } | { status: 'failed' };

/** One geocoder. Callers pick Census first and Geocodio only as a fallback. */
export interface GeocodeProvider {
  readonly source: GeocodeSource;
  lookup(address: string): Promise<ProviderLookup>;
}

export function clipGeocodeAccuracy(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export function pointInRange(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
