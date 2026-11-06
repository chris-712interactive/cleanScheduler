/** Escape `\`, `%`, and `_` so a PostgREST `ilike` filter is an exact pattern. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function emailsEqual(left: string | null | undefined, right: string): boolean {
  return (left ?? '').trim().toLowerCase() === right.trim().toLowerCase();
}

/** Phone alone is not consent. The checkbox and a phone number are both required. */
export function smsOptInGranted(input: { phone: string | null; optedIn: boolean }): boolean {
  return Boolean(input.phone?.trim()) && input.optedIn;
}

export function balanceDueCents(priceCents: number, depositCents: number): number {
  return Math.max(0, priceCents - Math.max(0, depositCents));
}

/** Blank property facts must not wipe values already stored on the location. */
export function propertyFactPatch(input: {
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  zoneId: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeReason: string | null;
}): {
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  service_zone_id?: string;
  latitude?: number;
  longitude?: number;
  geocode_reason?: string;
} {
  const patch: {
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    service_zone_id?: string;
    latitude?: number;
    longitude?: number;
    geocode_reason?: string;
  } = {};
  if (input.bedrooms != null) patch.bedrooms = input.bedrooms;
  if (input.bathrooms != null) patch.bathrooms = input.bathrooms;
  if (input.sqft != null) patch.sqft = input.sqft;
  if (input.zoneId) patch.service_zone_id = input.zoneId;
  if (input.latitude != null && input.longitude != null) {
    patch.latitude = input.latitude;
    patch.longitude = input.longitude;
  }
  if (input.geocodeReason) patch.geocode_reason = input.geocodeReason;
  return patch;
}

export function previewMatchesOffer(previewOfferId: string | null, offerId: string): boolean {
  return previewOfferId != null && previewOfferId === offerId;
}

export function shouldAttemptBookingNotification(input: {
  status: string;
  notifiedAt: string | null;
}): boolean {
  return input.status === 'confirmed' && !input.notifiedAt;
}

export type BookingReturnState =
  'confirmed' | 'refunded' | 'needs_review' | 'pending' | 'open_form';

/** A return token never falls through to a fresh booking form. */
export function bookingReturnState(status: string | null | undefined): BookingReturnState {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'refunded') return 'refunded';
  if (status === 'needs_review') return 'needs_review';
  if (status === 'hold' || status === 'expired' || status === 'cancelled') return 'pending';
  if (!status) return 'open_form';
  return 'pending';
}

export function publicSlotPayload(slot: {
  token: string;
  label: string;
  assigneeUserId?: string;
}): { token: string; label: string } {
  return { token: slot.token, label: slot.label };
}

/**
 * Platform client IP. `x-vercel-forwarded-for` is set by the edge and is not
 * the caller-supplied first hop of `x-forwarded-for`.
 */
export function trustedClientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for');
  const fromVercel = vercel?.split(',')[0]?.trim();
  if (fromVercel) return fromVercel.slice(0, 128);
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 128);
  return 'unknown';
}

export function rateLimitWindowStartMs(nowMs: number, windowMs: number): number {
  if (windowMs <= 0) return nowMs;
  return nowMs - (nowMs % windowMs);
}

export function rateLimitAllows(hitCount: number, limit: number): boolean {
  return hitCount <= limit;
}

export function firstVisitAndRecurringCents(
  priceCents: number,
  depositCents: number,
): { firstVisitCents: number; recurringCents: number } {
  return {
    firstVisitCents: balanceDueCents(priceCents, depositCents),
    recurringCents: Math.max(0, priceCents),
  };
}

/** Any failed finalize after Checkout is terminal: refund a charge, or flag the office. */
export function checkoutFinalizeOutcome(input: {
  paymentCollected: boolean;
}): 'refund' | 'flag_for_office' {
  return input.paymentCollected ? 'refund' : 'flag_for_office';
}

/**
 * Deposit ledger decision shared by the return URL and the webhook.
 * A checkout session that already has a payment must not create a second invoice.
 */
export function depositWritePlan(input: {
  depositCents: number;
  bookingInvoiceId: string | null;
  sessionPaymentInvoiceId: string | null;
}): 'skip' | 'link_existing' | 'ensure_payment' | 'create' {
  if (input.depositCents <= 0) return 'skip';
  if (input.sessionPaymentInvoiceId) return 'link_existing';
  if (input.bookingInvoiceId) return 'ensure_payment';
  return 'create';
}

/** Preview failures must show even when no slot list came back. */
export function previewFeedback(input: {
  error?: string;
  slotCount: number | null;
  offerMatches: boolean;
}): 'error' | 'empty' | 'slots' | 'none' {
  if (input.error) return 'error';
  if (input.slotCount == null || !input.offerMatches) return 'none';
  if (input.slotCount === 0) return 'empty';
  return 'slots';
}
