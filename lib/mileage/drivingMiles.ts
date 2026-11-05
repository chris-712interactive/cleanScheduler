import { milesFromRoutePayload } from '@/lib/mileage/model';

const MAPRICOT_ROUTE_URL = 'https://api.mapricot.com/routing/v1/route';

type Point = { lat: number; lng: number };

/**
 * Driving miles from Mapricot.
 * Set MAPRICOT_API_KEY to a server key with the routing scope. With no key,
 * the leg stays blank for the person to type. A straight-line distance is never returned.
 */
export async function fetchDrivingMiles(
  from: Point,
  to: Point,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  const key = process.env.MAPRICOT_API_KEY?.trim();
  if (!key) return null;
  try {
    const response = await fetchImpl(MAPRICOT_ROUTE_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        waypoints: [
          { lat: from.lat, lon: from.lng },
          { lat: to.lat, lon: to.lng },
        ],
        mode: 'drive',
      }),
    });
    if (!response.ok) return null;
    return milesFromRoutePayload(await response.json());
  } catch {
    return null;
  }
}
