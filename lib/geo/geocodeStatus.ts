export const GEOCODE_REASONS = [
  'outside_us',
  'incomplete',
  'no_match',
  'google_denied',
  'google_quota',
  'lookup_failed',
] as const;

export type GeocodeReason = (typeof GEOCODE_REASONS)[number];

export type GoogleLookupFailure = 'skipped' | 'no_match' | 'denied' | 'quota' | 'failed';

export type CensusLookupFailure = 'no_match' | 'failed';

/** Why a lookup with no point failed, after Google and Census have both run. */
export function geocodeReasonFromLookups(
  google: GoogleLookupFailure,
  census: CensusLookupFailure,
): GeocodeReason {
  if (google === 'denied') return 'google_denied';
  if (google === 'quota') return 'google_quota';
  if (google === 'no_match' || census === 'no_match') return 'no_match';
  return 'lookup_failed';
}

export function geocodeReasonDetail(reason: string | null | undefined): string | null {
  switch (reason) {
    case 'outside_us':
      return 'Outside the United States. Only US addresses are looked up.';
    case 'incomplete':
      return 'Too short to look up. Add a street, city, and state.';
    case 'no_match':
      return 'No map match. Check the street, city, state, and postal code.';
    case 'google_denied':
      return 'Google rejected the geocoding key.';
    case 'google_quota':
      return 'Google geocoding is over its limit. Save this address again later.';
    case 'lookup_failed':
      return 'The geocoding service did not respond. Save this address again.';
    default:
      return null;
  }
}

/** Sentence for an address that has text but no saved map point. */
export function missingGeocodeMessage(input: {
  reason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressParts: Array<string | null | undefined>;
}): string | null {
  const hasPoint = input.latitude != null && input.longitude != null;
  const hasAddress = input.addressParts.some((part) => (part ?? '').trim().length > 0);
  if (hasPoint || !hasAddress) return null;
  const detail = geocodeReasonDetail(input.reason);
  if (detail) return `Missing map point. ${detail}`;
  return 'Missing map point. Save this address again to look it up.';
}
