import type { LatLng } from '@/lib/schedule/optimizer/types';

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(from: LatLng, to: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line estimate. Returns null when either point is missing. */
export function travelMinutesBetween(
  from: LatLng | null,
  to: LatLng | null,
  travelSpeedMph: number,
): number | null {
  if (!from || !to || travelSpeedMph <= 0) return null;
  return (haversineMiles(from, to) / travelSpeedMph) * 60;
}

export type PlaceHint = {
  point: LatLng | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

const STATE_ABBR: Record<string, string> = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  'district of columbia': 'dc',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
};

export function normalizeUsState(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ') ?? '';
  if (!raw) return null;
  if (/^[a-z]{2}$/.test(raw)) return raw;
  return STATE_ABBR[raw] ?? null;
}

export function normalizeCity(value: string | null | undefined): string | null {
  const city = value?.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ') ?? '';
  return city || null;
}

export function postal5(value: string | null | undefined): string | null {
  return value?.match(/\d{5}/)?.[0] ?? null;
}

export function placeIsComparable(place: PlaceHint | null | undefined): boolean {
  if (!place) return false;
  if (place.point) return true;
  if (postal5(place.postalCode)) return true;
  return Boolean(normalizeCity(place.city) && normalizeUsState(place.state));
}

/**
 * Drive minutes from coordinates when both points exist.
 * Otherwise same postal code or the same city and state is a short hop,
 * the same state is a longer hop, and a different state is a multi-hour hop.
 * Returns null when the two places cannot be compared.
 */
/** A different state is estimated at this many minutes. Longer than this is too far to staff. */
export const TOO_FAR_DRIVE_MINUTES = 180;

export const TOO_FAR_LOCATION_REASON = 'Too far from this location';

export function isTooFarFromLocation(minutes: number | null): boolean {
  return minutes != null && minutes >= TOO_FAR_DRIVE_MINUTES;
}

export function approximateTravelMinutes(
  from: PlaceHint | null,
  to: PlaceHint | null,
  travelSpeedMph: number,
): number | null {
  const measured = travelMinutesBetween(from?.point ?? null, to?.point ?? null, travelSpeedMph);
  if (measured != null) return measured;
  if (!from || !to) return null;

  const fromPostal = postal5(from.postalCode);
  const toPostal = postal5(to.postalCode);
  if (fromPostal && toPostal && fromPostal === toPostal) return 15;

  const fromState = normalizeUsState(from.state);
  const toState = normalizeUsState(to.state);
  const fromCity = normalizeCity(from.city);
  const toCity = normalizeCity(to.city);
  if (fromCity && toCity && fromState && toState && fromCity === toCity && fromState === toState) {
    return 20;
  }
  if (fromState && toState && fromState === toState) return 90;
  if (fromState && toState && fromState !== toState) return 3 * 60;
  return null;
}

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
