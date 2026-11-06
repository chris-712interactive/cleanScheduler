import { postal5 } from '@/lib/schedule/optimizer/geo';

export type BookingZoneCoverage = {
  zoneId: string;
  postalCodes: string[];
};

export function normalizePostalList(raw: string): string[] {
  const found = raw.match(/\d{5}/g) ?? [];
  return [...new Set(found)];
}

/**
 * No coverage rows means the company has not limited instant booking by zone.
 * An offer can still name zones; those offers stay closed until coverage exists.
 */
export function matchBookingZone(input: {
  postalCode: string;
  coverage: BookingZoneCoverage[];
  offerZoneIds: string[];
}): { ok: true; zoneId: string | null } | { ok: false; error: string } {
  const activeCoverage = input.coverage.filter((zone) => zone.postalCodes.length > 0);

  if (activeCoverage.length === 0) {
    if (input.offerZoneIds.length > 0) {
      return {
        ok: false,
        error: 'This service is limited to specific areas, and those areas are not set up yet.',
      };
    }
    return { ok: true, zoneId: null };
  }

  const postal = postal5(input.postalCode);
  if (!postal) {
    return { ok: false, error: 'Enter a valid ZIP code so we can check the service area.' };
  }

  const match = activeCoverage.find((zone) => zone.postalCodes.includes(postal));
  if (!match) {
    return { ok: false, error: 'That address is outside the service area.' };
  }
  if (input.offerZoneIds.length > 0 && !input.offerZoneIds.includes(match.zoneId)) {
    return { ok: false, error: 'This service is not available in that area.' };
  }
  return { ok: true, zoneId: match.zoneId };
}
