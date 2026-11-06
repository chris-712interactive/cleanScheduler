'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import {
  instantOfferAllowedForSegment,
  instantPricingMethodAllowed,
} from '@/lib/booking/bookingAudience';
import { randomUUID } from 'node:crypto';
import { publicSlotPayload, rateLimitAllows, trustedClientIp } from '@/lib/booking/bookingGuards';
import {
  attachBookingCustomer,
  finalizeInstantBookingRecord,
  holdInstantBooking,
  parseInstantFrequency,
  loadTemplateJobTypes,
  prepareInstantBooking,
  visibleInstantOffers,
} from '@/lib/booking/confirmInstantBooking';
import { startInstantBookingCheckout } from '@/lib/booking/instantBookingCheckout';
import {
  instantBookingPolicyFromRow,
  loadInstantSlotsForTenant,
} from '@/lib/booking/loadInstantSlots';
import {
  depositForPrice,
  priceInstantOffer,
  type InstantPricingMethod,
} from '@/lib/booking/priceInstantOffer';
import {
  PUBLIC_BOOKING_UNAVAILABLE,
  publicBookingModeError,
  publicBookingModeFromRow,
} from '@/lib/booking/publicBookingMode';
import { matchBookingZone } from '@/lib/booking/serviceZoneMatch';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import {
  formatDateTimeInTimeZone,
  formatNextAppointmentWhen,
  formatVisitTime,
} from '@/lib/datetime/formatInTimeZone';
import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import { getPortalContext } from '@/lib/portal';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { PlaceHint } from '@/lib/schedule/optimizer/geo';
import { createAdminClient } from '@/lib/supabase/server';

export type InstantSlotChoice = {
  token: string;
  label: string;
  dateLabel: string;
  timeLabel: string;
};

export type InstantPreviewState = {
  error?: string;
  priceLabel?: string;
  depositLabel?: string | null;
  slots?: InstantSlotChoice[];
};

export type InstantConfirmState = {
  error?: string;
  success?: boolean;
  checkoutUrl?: string;
  whenLabel?: string;
  priceLabel?: string;
  title?: string;
};

const PREVIEW_LIMIT = 30;
const PREVIEW_WINDOW_MS = 10 * 60 * 1000;
const CONFIRM_LIMIT = 5;
const CONFIRM_WINDOW_MS = 60 * 60 * 1000;

function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function optionalWhole(raw: string): number | null {
  const value = optionalNumber(raw);
  if (value == null) return null;
  return Math.round(value);
}

async function authorizedInstantTenant(tenantSlug: string) {
  const portal = await getPortalContext();
  if (portal.kind !== 'site' || portal.tenantSlug !== tenantSlug) {
    return { error: PUBLIC_BOOKING_UNAVAILABLE as string };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug, name, timezone')
    .eq('slug', tenantSlug)
    .maybeSingle();
  if (!tenant) return { error: PUBLIC_BOOKING_UNAVAILABLE };

  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'publicBookingRequest')) {
    return { error: PUBLIC_BOOKING_UNAVAILABLE };
  }

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select(
      'public_booking_mode, public_booking_request_enabled, service_segment, instant_booking_lead_time_hours, instant_booking_window_days, instant_booking_buffer_minutes, instant_booking_slot_step_minutes, instant_booking_deposit_cents, instant_booking_collect_card, instant_booking_allow_recurring, instant_booking_allow_weekly, instant_booking_allow_biweekly, instant_booking_allow_monthly, instant_booking_travel_mph',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const mode = publicBookingModeFromRow(ops);
  const modeError = publicBookingModeError(mode, 'instant');
  if (modeError || !ops) return { error: modeError ?? PUBLIC_BOOKING_UNAVAILABLE };

  return {
    admin,
    tenant,
    policy: instantBookingPolicyFromRow(ops),
    serviceSegment: ops.service_segment,
  };
}

async function clientRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<string | null> {
  const headerList = await headers();
  const { data, error } = await admin.rpc('consume_public_rate_limit', {
    p_scope: scope,
    p_client_key: trustedClientIp(headerList),
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });
  if (error || typeof data !== 'number' || !rateLimitAllows(data, limit)) {
    return 'Too many attempts. Please try again later.';
  }
  return null;
}

export async function previewInstantBookingAction(
  _prev: InstantPreviewState,
  formData: FormData,
): Promise<InstantPreviewState> {
  const limited = await clientRateLimit(
    createAdminClient(),
    'instant_preview',
    PREVIEW_LIMIT,
    PREVIEW_WINDOW_MS,
  );
  if (limited) return { error: limited };

  const honeypot = String(formData.get('company') ?? '').trim();
  if (honeypot) return { slots: [] };

  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const offerId = String(formData.get('offer_id') ?? '').trim();
  const gated = await authorizedInstantTenant(tenantSlug);
  if ('error' in gated) return { error: gated.error };

  const { data: offers } = await gated.admin
    .from('tenant_instant_booking_offers')
    .select('*')
    .eq('tenant_id', gated.tenant.id)
    .eq('id', offerId);
  const templateJobTypes = await loadTemplateJobTypes(
    gated.admin,
    gated.tenant.id,
    (offers ?? []).map((offer) => offer.service_template_id),
  );
  const offer = visibleInstantOffers(offers ?? [], gated.serviceSegment, templateJobTypes)[0];
  if (!offer) return { error: 'Choose a service to continue.' };
  if (!instantPricingMethodAllowed(offer.pricing_method, gated.serviceSegment)) {
    return { error: 'That price is not available for this cleaning company.' };
  }

  const postalCode = String(formData.get('postal_code') ?? '').trim();
  const { data: coverageRows } = await gated.admin
    .from('tenant_instant_booking_zone_coverage')
    .select('service_zone_id, postal_codes')
    .eq('tenant_id', gated.tenant.id);
  const zone = matchBookingZone({
    postalCode,
    coverage: (coverageRows ?? []).map((row) => ({
      zoneId: row.service_zone_id,
      postalCodes: row.postal_codes ?? [],
    })),
    offerZoneIds: offer.zone_ids ?? [],
  });
  if (!zone.ok) return { error: zone.error };

  const bedrooms = optionalWhole(String(formData.get('bedrooms') ?? ''));
  const bathrooms = optionalNumber(String(formData.get('bathrooms') ?? ''));
  const sqft = optionalWhole(String(formData.get('sqft') ?? ''));
  const priced = priceInstantOffer({
    method: offer.pricing_method as InstantPricingMethod,
    baseAmountCents: offer.base_amount_cents,
    perSqftCents: offer.per_sqft_cents,
    perBedroomCents: offer.per_bedroom_cents,
    perBathroomCents: offer.per_bathroom_cents,
    sqft,
    bedrooms,
    bathrooms,
  });
  if ('error' in priced) return { error: priced.error };

  const address = {
    line1: String(formData.get('address_line1') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    state: String(formData.get('state') ?? '').trim(),
    postalCode,
  };
  const geocoded = await lookupUsAddress(address).catch(() => ({ point: null }));
  const destination: PlaceHint = {
    point: geocoded.point,
    city: address.city,
    state: address.state,
    postalCode,
  };

  const loaded = await loadInstantSlotsForTenant(gated.admin, {
    tenantId: gated.tenant.id,
    policy: gated.policy,
    durationMinutes: offer.duration_minutes,
    destination,
  });
  if ('error' in loaded) return { error: loaded.error };

  const deposit = depositForPrice(priced.amountCents, gated.policy.depositCents);
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  await gated.admin
    .from('tenant_instant_slot_tokens')
    .delete()
    .eq('tenant_id', gated.tenant.id)
    .lt('expires_at', new Date().toISOString());
  const slots = loaded.slots.map((slot) => {
    const token = randomUUID().replace(/-/g, '');
    return {
      token,
      offer_id: offer.id,
      assignee_user_id: slot.assigneeUserId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      label: formatNextAppointmentWhen(slot.startsAt, loaded.timezone),
      dateLabel: formatDateTimeInTimeZone(slot.startsAt, loaded.timezone, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      timeLabel: formatVisitTime(slot.startsAt, loaded.timezone),
    };
  });
  if (slots.length > 0) {
    const { error: tokenError } = await gated.admin.from('tenant_instant_slot_tokens').insert(
      slots.map((slot) => ({
        token: slot.token,
        tenant_id: gated.tenant.id,
        offer_id: slot.offer_id,
        assignee_user_id: slot.assignee_user_id,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        expires_at: expiresAt,
      })),
    );
    if (tokenError) return { error: 'Could not check crew availability.' };
  }
  return {
    priceLabel: `$${formatCentsAsDollars(priced.amountCents)}`,
    depositLabel: deposit > 0 ? `$${formatCentsAsDollars(deposit)}` : null,
    slots: slots.map((slot) => publicSlotPayload(slot)),
  };
}

export async function confirmInstantBookingAction(
  _prev: InstantConfirmState,
  formData: FormData,
): Promise<InstantConfirmState> {
  const limited = await clientRateLimit(
    createAdminClient(),
    'instant_confirm',
    CONFIRM_LIMIT,
    CONFIRM_WINDOW_MS,
  );
  if (limited) return { error: limited };

  const honeypot = String(formData.get('company') ?? '').trim();
  if (honeypot) return { success: true, title: 'Visit', whenLabel: '', priceLabel: '' };

  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const gated = await authorizedInstantTenant(tenantSlug);
  if ('error' in gated) return { error: gated.error };

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const addressLine1 = String(formData.get('address_line1') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const postalCode = String(formData.get('postal_code') ?? '').trim();
  const frequency = parseInstantFrequency(String(formData.get('frequency') ?? ''));
  if (
    !name ||
    !email.includes('@') ||
    !addressLine1 ||
    !city ||
    !state ||
    !postalCode ||
    !frequency
  ) {
    return { error: 'Name, email, and a full service address are required.' };
  }

  const since = new Date(Date.now() - CONFIRM_WINDOW_MS).toISOString();
  const { count } = await gated.admin
    .from('tenant_instant_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', gated.tenant.id)
    .eq('customer_email', email)
    .gte('created_at', since);
  if ((count ?? 0) >= CONFIRM_LIMIT) {
    return { error: 'Too many bookings from this email. Please try again later.' };
  }

  const token = String(formData.get('slot_token') ?? '').trim();
  const { data: slotToken } = await gated.admin
    .from('tenant_instant_slot_tokens')
    .select('token, offer_id, assignee_user_id, starts_at, ends_at, expires_at')
    .eq('token', token)
    .eq('tenant_id', gated.tenant.id)
    .maybeSingle();
  if (!slotToken || new Date(slotToken.expires_at).getTime() <= Date.now()) {
    return { error: 'That time is no longer available. Choose another.' };
  }
  if (slotToken.offer_id !== String(formData.get('offer_id') ?? '').trim()) {
    return { error: 'Choose a service, then pick a time again.' };
  }

  const { data: coverageRows } = await gated.admin
    .from('tenant_instant_booking_zone_coverage')
    .select('service_zone_id, postal_codes')
    .eq('tenant_id', gated.tenant.id);

  const prepared = await prepareInstantBooking(gated.admin, {
    tenantId: gated.tenant.id,
    policy: gated.policy,
    offerId: slotToken.offer_id,
    frequency,
    startsAt: slotToken.starts_at,
    endsAt: slotToken.ends_at,
    assigneeUserId: slotToken.assignee_user_id,
    addressLine1,
    city,
    state,
    postalCode,
    bedrooms: optionalWhole(String(formData.get('bedrooms') ?? '')),
    bathrooms: optionalNumber(String(formData.get('bathrooms') ?? '')),
    sqft: optionalWhole(String(formData.get('sqft') ?? '')),
    coverage: (coverageRows ?? []).map((row) => ({
      zoneId: row.service_zone_id,
      postalCodes: row.postal_codes ?? [],
    })),
  });
  if (!prepared.ok) return { error: prepared.error };

  if (
    !instantOfferAllowedForSegment(
      {
        audience: prepared.prepared.offer.audience,
        pricingMethod: prepared.prepared.offer.pricing_method,
        templateJobType: prepared.prepared.offer.service_template_id
          ? (
              await loadTemplateJobTypes(gated.admin, gated.tenant.id, [
                prepared.prepared.offer.service_template_id,
              ])
            ).get(prepared.prepared.offer.service_template_id)
          : null,
      },
      gated.serviceSegment,
    ) ||
    !instantPricingMethodAllowed(prepared.prepared.offer.pricing_method, gated.serviceSegment)
  ) {
    return { error: 'That service is not available to book.' };
  }

  const smsOptIn = formData.get('sms_opt_in') === 'on';
  const held = await holdInstantBooking(gated.admin, {
    tenantId: gated.tenant.id,
    prepared: prepared.prepared,
    email,
    phone,
    name,
    bufferMinutes: gated.policy.bufferMinutes,
    travelMph: gated.policy.travelMph,
    intake: {
      addressLine1,
      city,
      state,
      postalCode,
      bedrooms: optionalWhole(String(formData.get('bedrooms') ?? '')),
      bathrooms: optionalNumber(String(formData.get('bathrooms') ?? '')),
      sqft: optionalWhole(String(formData.get('sqft') ?? '')),
      zoneId: prepared.prepared.zoneId,
      latitude: prepared.prepared.destination?.point?.lat ?? null,
      longitude: prepared.prepared.destination?.point?.lng ?? null,
      geocodeReason: null,
      smsOptIn,
    },
  });
  if ('error' in held) return { error: held.error };
  await gated.admin.from('tenant_instant_slot_tokens').delete().eq('token', token);

  const needsCheckout = prepared.prepared.depositCents > 0 || gated.policy.collectCard;
  if (needsCheckout) {
    const checkout = await startInstantBookingCheckout(gated.admin, {
      tenantId: gated.tenant.id,
      tenantSlug: gated.tenant.slug,
      bookingId: held.bookingId,
      publicToken: held.publicToken,
      email,
      name,
      title: prepared.prepared.offer.name,
      currency: prepared.prepared.offer.currency || 'usd',
      depositCents: prepared.prepared.depositCents,
      collectCard: gated.policy.collectCard,
    });
    if ('error' in checkout) return { error: checkout.error };
    return { checkoutUrl: checkout.url };
  }

  const attached = await attachBookingCustomer(gated.admin, gated.tenant.id, held.bookingId);
  if ('error' in attached) return { error: attached.error };

  const finalized = await finalizeInstantBookingRecord(
    gated.admin,
    gated.tenant.id,
    held.bookingId,
  );
  if ('error' in finalized) return { error: finalized.error };
  revalidatePath('/schedule');
  return {
    checkoutUrl: `${getPublicOrigin(gated.tenant.slug)}/book?booking=${encodeURIComponent(held.publicToken)}`,
  };
}
