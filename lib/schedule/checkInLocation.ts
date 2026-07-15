export type CheckInLocationStatus = 'captured' | 'denied' | 'unavailable' | 'unsupported';

export type ParsedCheckInLocation =
  | {
      status: 'captured';
      lat: number;
      lng: number;
      accuracyM: number | null;
    }
  | {
      status: Exclude<CheckInLocationStatus, 'captured'>;
      lat: null;
      lng: null;
      accuracyM: null;
    };

const STATUS_VALUES = new Set<CheckInLocationStatus>([
  'captured',
  'denied',
  'unavailable',
  'unsupported',
]);

function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse optional GPS fields posted from the field check-in / complete forms.
 * Invalid or incomplete captured payloads are treated as unavailable (never block check-in).
 */
export function parseCheckInLocationFromFormData(formData: FormData): ParsedCheckInLocation | null {
  const statusRaw = String(formData.get('check_in_location_status') ?? '')
    .trim()
    .toLowerCase();
  if (!statusRaw) return null;
  if (!STATUS_VALUES.has(statusRaw as CheckInLocationStatus)) return null;

  const status = statusRaw as CheckInLocationStatus;
  if (status !== 'captured') {
    return { status, lat: null, lng: null, accuracyM: null };
  }

  const lat = parseOptionalNumber(formData.get('check_in_lat'));
  const lng = parseOptionalNumber(formData.get('check_in_lng'));
  const accuracyM = parseOptionalNumber(formData.get('check_in_accuracy_m'));

  if (
    lat == null ||
    lng == null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (accuracyM != null && accuracyM < 0)
  ) {
    return { status: 'unavailable', lat: null, lng: null, accuracyM: null };
  }

  return {
    status: 'captured',
    lat,
    lng,
    accuracyM: accuracyM != null && accuracyM <= 50_000 ? accuracyM : null,
  };
}

export function checkInLocationUpdateFields(parsed: ParsedCheckInLocation): {
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_location_status: CheckInLocationStatus;
} {
  return {
    check_in_lat: parsed.lat,
    check_in_lng: parsed.lng,
    check_in_accuracy_m: parsed.accuracyM,
    check_in_location_status: parsed.status,
  };
}

export function googleMapsSearchUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function formatCheckInLocationProof(input: {
  status: CheckInLocationStatus | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
}): { label: string; mapsUrl: string | null } | null {
  if (!input.status) return null;
  if (input.status === 'captured' && input.lat != null && input.lng != null) {
    const accuracy =
      input.accuracyM != null && Number.isFinite(input.accuracyM)
        ? ` (±${Math.round(input.accuracyM)} m)`
        : '';
    return {
      label: `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}${accuracy}`,
      mapsUrl: googleMapsSearchUrl(input.lat, input.lng),
    };
  }
  if (input.status === 'denied') {
    return { label: 'Location permission denied', mapsUrl: null };
  }
  if (input.status === 'unsupported') {
    return { label: 'Location not supported on this device', mapsUrl: null };
  }
  return { label: 'Location unavailable', mapsUrl: null };
}
