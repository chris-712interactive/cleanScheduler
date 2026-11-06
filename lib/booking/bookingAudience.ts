/**
 * Instant booking is residential until the tenant service-segment setting exists.
 * Call `resolveTenantBookingSegment` from offer loading — that is the only
 * checkpoint a later segment setting needs to replace.
 */
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
 * Tenant service segment is owned by a separate setting. Instant booking stays
 * residential until that value is passed into this function.
 */
export function resolveTenantBookingSegment(): BookingServiceAudience {
  return 'residential';
}
