import { milesFromOsrmPayload } from '@/lib/mileage/model';

type Point = { lat: number; lng: number };

/**
 * Driving miles from a hosted OpenStreetMap router.
 * Set OSRM_BASE_URL to the router origin. With no URL, the leg stays blank
 * for the person to type. A straight-line distance is never returned.
 */
export async function fetchDrivingMiles(
  from: Point,
  to: Point,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  const base = process.env.OSRM_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  const path = `/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  try {
    const response = await fetchImpl(`${base}${path}`, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return milesFromOsrmPayload(await response.json());
  } catch {
    return null;
  }
}
