/**
 * Public /book mode. `public_booking_mode` is the source of truth.
 * A missing settings row matches the historical default: the request form is on.
 */
export const PUBLIC_BOOKING_UNAVAILABLE = 'Online booking is unavailable right now.';

export type PublicBookingMode = 'off' | 'request' | 'instant';

export type PublicBookingAction = 'request' | 'instant';

export function parsePublicBookingMode(raw: string | null | undefined): PublicBookingMode | null {
  if (raw === 'off' || raw === 'request' || raw === 'instant') return raw;
  return null;
}

export function publicBookingModeFromRow(
  row: {
    public_booking_mode?: string | null;
    public_booking_request_enabled?: boolean | null;
  } | null,
): PublicBookingMode {
  const parsed = parsePublicBookingMode(row?.public_booking_mode);
  if (parsed) return parsed;
  if (row?.public_booking_request_enabled === false) return 'off';
  return 'request';
}

/** Null when the action is allowed. Otherwise the public error string. */
export function publicBookingModeError(
  mode: PublicBookingMode,
  action: PublicBookingAction,
): string | null {
  if (mode === 'off' || mode !== action) return PUBLIC_BOOKING_UNAVAILABLE;
  return null;
}

export function publicBookingPageOpen(mode: PublicBookingMode): boolean {
  return mode !== 'off';
}
