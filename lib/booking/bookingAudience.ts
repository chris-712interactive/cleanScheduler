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
  if (tenantSegment === 'both') return true;
  // A stamped "both" is not permission to book after the workspace narrows.
  if (offerAudience === 'both') return false;
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

export type InstantOfferLineInput = {
  audience?: string | null;
  pricingMethod?: string | null;
  templateJobType?: string | null;
};

/** What line of work an offer actually is. Audience "both" is not a line by itself. */
export function instantOfferServiceLine(
  offer: InstantOfferLineInput,
): 'residential' | 'commercial' | 'unspecified' {
  if (offer.pricingMethod === 'per_sqft' || offer.templateJobType === 'commercial') {
    return 'commercial';
  }
  if (
    offer.pricingMethod === 'beds_baths' ||
    offer.templateJobType === 'residential' ||
    offer.templateJobType === 'short_term_rental'
  ) {
    return 'residential';
  }
  if (offer.audience === 'commercial') return 'commercial';
  if (offer.audience === 'residential') return 'residential';
  return 'unspecified';
}

export function instantOfferAllowedForSegment(
  offer: InstantOfferLineInput | string | null | undefined,
  serviceSegment?: TenantServiceSegment | string | null,
): boolean {
  const input: InstantOfferLineInput =
    typeof offer === 'string' || offer == null ? { audience: offer } : offer;
  const capabilities = capabilitiesForSegment(parseTenantServiceSegment(serviceSegment ?? 'both'));
  const line = instantOfferServiceLine(input);
  if (line === 'commercial') return capabilities.offersCommercial;
  if (line === 'residential') return capabilities.offersResidential;
  // No specific line, including a leftover audience of "both". Only a mixed workspace may book it.
  return capabilities.offersBoth;
}

/** Square-foot booking prices are commercial. Beds and baths are residential. */
export function instantPricingMethodAllowed(
  pricingMethod: string | null | undefined,
  serviceSegment?: TenantServiceSegment | string | null,
): boolean {
  const capabilities = capabilitiesForSegment(parseTenantServiceSegment(serviceSegment ?? 'both'));
  if (pricingMethod === 'per_sqft') return capabilities.sqftBids;
  if (pricingMethod === 'beds_baths') return capabilities.showBedsBaths;
  return true;
}
