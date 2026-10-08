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

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
