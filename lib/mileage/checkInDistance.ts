import { haversineMiles } from '@/lib/schedule/optimizer/geo';

/** About 500 meters. A check-in past this is a flag, not a new stop. */
export const FAR_CHECK_IN_MILES = 0.31;

export function checkInIsAwayFromStop(
  stop: { lat: number | null; lng: number | null },
  checkIn: { lat: number | null; lng: number | null },
): boolean {
  if (stop.lat == null || stop.lng == null || checkIn.lat == null || checkIn.lng == null) {
    return false;
  }
  return (
    haversineMiles({ lat: stop.lat, lng: stop.lng }, { lat: checkIn.lat, lng: checkIn.lng }) >
    FAR_CHECK_IN_MILES
  );
}
