import {
  bookingServiceAllowed,
  capabilitiesForSegment,
  parseTenantServiceSegment,
  type TenantServiceSegment,
} from '@/lib/tenant/serviceSegment';

export type BookingServiceAudience = 'residential' | 'commercial' | 'both';

export function parseBookingServiceAudience(
  raw: string | null | undefined,
): BookingServiceAudience {
  if (raw === 'commercial' || raw === 'both') return raw;
  return 'residential';
}

export function offerMatchesBookingSegment(
  offerAudience: BookingServiceAudience,
  tenantSegment: BookingServiceAudience,
): boolean {
  if (tenantSegment === 'both' || offerAudience === 'both') return true;
  return offerAudience === tenantSegment;
}

/**
 * Booking audience for a workspace. Comes from the tenant service segment:
 * residential-only businesses cannot take commercial bookings, and commercial-only
 * businesses cannot take residential ones. `both` keeps every offer.
 */
export function resolveTenantBookingSegment(
  serviceSegment?: TenantServiceSegment | string | null,
): BookingServiceAudience {
  const capabilities = capabilitiesForSegment(parseTenantServiceSegment(serviceSegment ?? 'both'));
  const residential = bookingServiceAllowed(capabilities, 'Standard clean');
  const commercial = bookingServiceAllowed(capabilities, 'Office / commercial');
  if (residential && commercial) return 'both';
  if (commercial) return 'commercial';
  if (residential) return 'residential';
  return 'both';
}

export function instantOfferAllowedForSegment(
  offerAudience: string | null | undefined,
  serviceSegment?: TenantServiceSegment | string | null,
): boolean {
  return offerMatchesBookingSegment(
    parseBookingServiceAudience(offerAudience),
    resolveTenantBookingSegment(serviceSegment),
  );
}
