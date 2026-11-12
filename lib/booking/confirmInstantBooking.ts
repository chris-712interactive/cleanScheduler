import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  instantOfferAllowedForSegment,
  instantPricingMethodAllowed,
} from '@/lib/booking/bookingAudience';
import {
  defaultPropertyKindForTenant,
  loadTenantServiceSegment,
} from '@/lib/tenant/loadTenantServiceSegment';
import {
  loadInstantSlotsForTenant,
  type InstantBookingPolicy,
} from '@/lib/booking/loadInstantSlots';
import {
  depositForPrice,
  frequencyAllowed,
  priceInstantOffer,
  type InstantBookingFrequency,
  type InstantPricingMethod,
} from '@/lib/booking/priceInstantOffer';
import { recurringRuleFromFrequency } from '@/lib/booking/recurringRuleFromFrequency';
import { matchBookingZone, type BookingZoneCoverage } from '@/lib/booking/serviceZoneMatch';
import { assertTenantCanCreateAutomationWorkflow } from '@/lib/billing/automationWorkflows';
import { assertMeteredLimit } from '@/lib/billing/checkLimit';
import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import { findMatchingInstantSlot } from '@/lib/booking/computeInstantSlots';
import type { PlaceHint } from '@/lib/schedule/optimizer/geo';
import { postal5 } from '@/lib/schedule/optimizer/geo';
import type { Database, Json } from '@/lib/supabase/database.types';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';
import {
  emailsEqual,
  escapeIlikePattern,
  propertyFactPatch,
  smsOptInGranted,
} from '@/lib/booking/bookingGuards';

type Admin = SupabaseClient<Database>;

export type InstantOfferRow = Database['public']['Tables']['tenant_instant_booking_offers']['Row'];

const FREQUENCY_VALUES = new Set<InstantBookingFrequency>([
  'one_time',
  'weekly',
  'biweekly',
  'monthly',
]);

export function parseInstantFrequency(raw: string): InstantBookingFrequency | null {
  return FREQUENCY_VALUES.has(raw as InstantBookingFrequency)
    ? (raw as InstantBookingFrequency)
    : null;
}

export function visibleInstantOffers<
  T extends {
    is_active: boolean;
    audience: string;
    pricing_method: string;
    service_template_id?: string | null;
  },
>(
  offers: T[],
  serviceSegment?: string | null,
  templateJobTypeById?: ReadonlyMap<string, string | null>,
): T[] {
  return offers.filter((offer) => {
    if (!offer.is_active) return false;
    const templateJobType = offer.service_template_id
      ? (templateJobTypeById?.get(offer.service_template_id) ?? null)
      : null;
    return instantOfferAllowedForSegment(
      {
        audience: offer.audience,
        pricingMethod: offer.pricing_method,
        templateJobType,
      },
      serviceSegment,
    );
  });
}

export async function loadTemplateJobTypes(
  admin: Admin,
  tenantId: string,
  templateIds: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const ids = [...new Set(templateIds.filter((id): id is string => Boolean(id)))];
  const jobTypes = new Map<string, string | null>();
  if (ids.length === 0) return jobTypes;
  const { data } = await admin
    .from('tenant_service_templates')
    .select('id, job_type')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  for (const row of data ?? []) jobTypes.set(row.id, row.job_type);
  return jobTypes;
}

function splitPersonName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? 'Guest', last: parts.slice(1).join(' ') };
}

function normalizeLine(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

type FinalizePayload = {
  ok?: boolean;
  finalized?: boolean;
  visit_id?: string;
  recurring_rule_id?: string | null;
};

function readFinalizePayload(data: Json): FinalizePayload {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data as FinalizePayload;
}

export type PreparedInstantBooking = {
  offer: InstantOfferRow;
  priceCents: number;
  depositCents: number;
  frequency: InstantBookingFrequency;
  rrule: string | null;
  startsAt: string;
  endsAt: string;
  assigneeUserId: string;
  zoneId: string | null;
  destination: PlaceHint | null;
};

export async function prepareInstantBooking(
  admin: Admin,
  input: {
    tenantId: string;
    policy: InstantBookingPolicy;
    offerId: string;
    frequency: InstantBookingFrequency;
    startsAt: string;
    endsAt: string;
    assigneeUserId: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    coverage: BookingZoneCoverage[];
    now?: Date;
  },
): Promise<{ ok: true; prepared: PreparedInstantBooking } | { ok: false; error: string }> {
  const { data: offer, error: offerError } = await admin
    .from('tenant_instant_booking_offers')
    .select('*')
    .eq('id', input.offerId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (offerError || !offer) return { ok: false, error: 'Choose a service to continue.' };

  const serviceSegment = await loadTenantServiceSegment(admin, input.tenantId);
  const templateJobTypes = await loadTemplateJobTypes(admin, input.tenantId, [
    offer.service_template_id,
  ]);
  const visible = visibleInstantOffers([offer], serviceSegment, templateJobTypes);
  if (visible.length === 0) return { ok: false, error: 'That service is not available to book.' };
  if (!instantPricingMethodAllowed(offer.pricing_method, serviceSegment)) {
    return { ok: false, error: 'That price is not available for this cleaning company.' };
  }

  if (offer.service_plan_id) {
    const { data: plan } = await admin
      .from('service_plans')
      .select('id, is_active')
      .eq('id', offer.service_plan_id)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (!plan?.is_active) return { ok: false, error: 'That service is not available to book.' };
  }
  if (offer.service_template_id) {
    const { data: template } = await admin
      .from('tenant_service_templates')
      .select('id, is_active')
      .eq('id', offer.service_template_id)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (!template?.is_active) return { ok: false, error: 'That service is not available to book.' };
  }

  if (!frequencyAllowed(input.frequency, input.policy)) {
    return { ok: false, error: 'That visit frequency is not offered.' };
  }

  const zone = matchBookingZone({
    postalCode: input.postalCode,
    coverage: input.coverage,
    offerZoneIds: offer.zone_ids ?? [],
  });
  if (!zone.ok) return { ok: false, error: zone.error };

  const priced = priceInstantOffer({
    method: offer.pricing_method as InstantPricingMethod,
    baseAmountCents: offer.base_amount_cents,
    perSqftCents: offer.per_sqft_cents,
    perBedroomCents: offer.per_bedroom_cents,
    perBathroomCents: offer.per_bathroom_cents,
    sqft: input.sqft,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
  });
  if ('error' in priced) return { ok: false, error: priced.error };

  const geocoded = await lookupUsAddress({
    line1: input.addressLine1,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  }).catch(() => ({ point: null, reason: null }));

  const destination: PlaceHint = {
    point: geocoded.point,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  };

  const loaded = await loadInstantSlotsForTenant(admin, {
    tenantId: input.tenantId,
    policy: input.policy,
    durationMinutes: offer.duration_minutes,
    destination,
    now: input.now,
  });
  if ('error' in loaded) return { ok: false, error: loaded.error };

  const slot = findMatchingInstantSlot(loaded.slots, {
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    assigneeUserId: input.assigneeUserId,
  });
  if (!slot) return { ok: false, error: 'That time is no longer available. Choose another.' };

  const rrule = recurringRuleFromFrequency({
    frequency: input.frequency,
    startsAt: slot.startsAt,
  });
  if (input.frequency !== 'one_time' && !rrule) {
    return { ok: false, error: 'Could not schedule a repeating visit for that time.' };
  }

  return {
    ok: true,
    prepared: {
      offer,
      priceCents: priced.amountCents,
      depositCents: depositForPrice(priced.amountCents, input.policy.depositCents),
      frequency: input.frequency,
      rrule,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      assigneeUserId: slot.assigneeUserId,
      zoneId: zone.zoneId,
      destination,
    },
  };
}

export async function findCustomerByEmail(
  admin: Admin,
  tenantId: string,
  email: string,
): Promise<string | null> {
  const { data: identities } = await admin
    .from('customer_identities')
    .select('id, email')
    .ilike('email', escapeIlikePattern(email))
    .limit(20);
  const identityIds = (identities ?? [])
    .filter((row) => emailsEqual(row.email, email))
    .map((row) => row.id);
  if (identityIds.length === 0) return null;
  const { data: customers } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('customer_identity_id', identityIds)
    .limit(1);
  return customers?.[0]?.id ?? null;
}

export async function ensureBookingCustomer(
  admin: Admin,
  input: {
    tenantId: string;
    name: string;
    email: string;
    phone: string | null;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    zoneId: string | null;
    latitude: number | null;
    longitude: number | null;
    geocodeReason: string | null;
    smsOptIn: boolean;
  },
): Promise<{ customerId: string; propertyId: string } | { error: string }> {
  const optedIn = smsOptInGranted({ phone: input.phone, optedIn: input.smsOptIn });
  const existingId = await findCustomerByEmail(admin, input.tenantId, input.email);
  let customerId = existingId;

  if (!customerId) {
    try {
      await assertMeteredLimit(admin, input.tenantId, 'maxActiveCustomers', 1);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'This company is not taking new customers.',
      };
    }

    const { first, last } = splitPersonName(input.name);
    const identity = await admin
      .from('customer_identities')
      .insert({
        email: input.email,
        first_name: first,
        last_name: last || null,
        full_name: syncedFullNameFromParts(first, last),
        phone: input.phone,
      })
      .select('id')
      .single();
    if (identity.error || !identity.data) {
      return { error: 'Could not save your contact details.' };
    }

    const customer = await admin
      .from('customers')
      .insert({
        tenant_id: input.tenantId,
        customer_identity_id: identity.data.id,
        status: 'active',
      })
      .select('id')
      .single();
    if (customer.error || !customer.data) {
      await admin.from('customer_identities').delete().eq('id', identity.data.id);
      return { error: 'Could not save your contact details.' };
    }
    customerId = customer.data.id;

    const link = await admin.from('customer_tenant_links').insert({
      customer_identity_id: identity.data.id,
      tenant_id: input.tenantId,
      customer_id: customerId,
      is_primary: true,
    });
    if (link.error) {
      await admin.from('customers').delete().eq('id', customerId);
      await admin.from('customer_identities').delete().eq('id', identity.data.id);
      return { error: 'Could not save your contact details.' };
    }

    const profile = await admin.from('tenant_customer_profiles').insert({
      tenant_id: input.tenantId,
      customer_id: customerId,
      preferred_contact_method: 'email',
      preferred_payment_method: 'card',
      sms_transactional_opt_in: optedIn,
      sms_transactional_opt_in_at: optedIn ? new Date().toISOString() : null,
    });
    if (profile.error) {
      await admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
      await admin.from('customers').delete().eq('id', customerId);
      await admin.from('customer_identities').delete().eq('id', identity.data.id);
      return { error: 'Could not save your contact details.' };
    }
  }

  const { data: properties } = await admin
    .from('tenant_customer_properties')
    .select('id, address_line1, postal_code, is_primary')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', customerId);

  const postal = postal5(input.postalCode);
  const line = normalizeLine(input.addressLine1);
  const matched = (properties ?? []).find((property) => {
    const sameLine = normalizeLine(property.address_line1 ?? '') === line;
    const samePostal = postal5(property.postal_code) === postal;
    return sameLine && samePostal;
  });
  if (matched) {
    const patch = propertyFactPatch({
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      sqft: input.sqft,
      zoneId: input.zoneId,
      latitude: input.latitude,
      longitude: input.longitude,
      geocodeReason: input.geocodeReason,
    });
    if (Object.keys(patch).length > 0) {
      await admin
        .from('tenant_customer_properties')
        .update(patch)
        .eq('id', matched.id)
        .eq('tenant_id', input.tenantId);
    }
    if (optedIn) {
      await admin
        .from('tenant_customer_profiles')
        .update({
          sms_transactional_opt_in: true,
          sms_transactional_opt_in_at: new Date().toISOString(),
        })
        .eq('tenant_id', input.tenantId)
        .eq('customer_id', customerId);
    }
    return { customerId, propertyId: matched.id };
  }

  const property = await admin
    .from('tenant_customer_properties')
    .insert({
      tenant_id: input.tenantId,
      customer_id: customerId,
      label: 'Booked online',
      property_kind: await defaultPropertyKindForTenant(admin, input.tenantId),
      address_line1: input.addressLine1,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      sqft: input.sqft,
      service_zone_id: input.zoneId,
      latitude: input.latitude,
      longitude: input.longitude,
      geocode_reason: input.geocodeReason,
      is_primary: (properties ?? []).length === 0,
    })
    .select('id')
    .single();

  if (property.error || !property.data) {
    return { error: 'Could not save the service address.' };
  }
  return { customerId, propertyId: property.data.id };
}

export type BookingIntake = {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  zoneId: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeReason: string | null;
  smsOptIn: boolean;
};

export async function holdInstantBooking(
  admin: Admin,
  input: {
    tenantId: string;
    prepared: PreparedInstantBooking;
    email: string;
    phone: string | null;
    name: string;
    bufferMinutes: number;
    travelMph: number;
    intake: BookingIntake;
  },
): Promise<{ bookingId: string; publicToken: string } | { error: string }> {
  if (input.prepared.frequency !== 'one_time') {
    try {
      await assertTenantCanCreateAutomationWorkflow(admin, input.tenantId);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Repeating visits are not available on this plan.',
      };
    }
  }

  const bookingId = randomUUID();
  const publicToken = randomUUID().replace(/-/g, '');
  const { error } = await admin.rpc('hold_instant_booking', {
    p_booking_id: bookingId,
    p_tenant_id: input.tenantId,
    p_public_token: publicToken,
    p_offer_id: input.prepared.offer.id,
    p_customer_id: null,
    p_property_id: null,
    p_assignee_user_id: input.prepared.assigneeUserId,
    p_frequency: input.prepared.frequency,
    p_starts_at: input.prepared.startsAt,
    p_ends_at: input.prepared.endsAt,
    p_duration_minutes: input.prepared.offer.duration_minutes,
    p_price_cents: input.prepared.priceCents,
    p_deposit_cents: input.prepared.depositCents,
    p_currency: input.prepared.offer.currency || 'usd',
    p_customer_email: input.email,
    p_customer_phone: input.phone ?? '',
    p_customer_name: input.name,
    p_title: input.prepared.offer.name,
    p_rrule_definition: input.prepared.rrule ?? '',
    p_buffer_minutes: input.bufferMinutes,
    p_hold_minutes: 20,
    p_place_lat: input.prepared.destination?.point?.lat ?? null,
    p_place_lng: input.prepared.destination?.point?.lng ?? null,
    p_place_city: input.prepared.destination?.city ?? '',
    p_place_state: input.prepared.destination?.state ?? '',
    p_place_postal: input.prepared.destination?.postalCode ?? '',
    p_travel_mph: input.travelMph,
    p_intake: input.intake as Json,
  });

  if (error) {
    if (error.message.includes('slot_taken')) {
      return { error: 'That time was just taken. Choose another.' };
    }
    return { error: 'Could not reserve that time. Please try again.' };
  }

  return { bookingId, publicToken };
}

export async function finalizeInstantBookingRecord(
  admin: Admin,
  tenantId: string,
  bookingId: string,
): Promise<
  | { finalized: boolean; visitId: string; recurringRuleId: string | null }
  | { error: string; code: 'slot_taken' | 'other' }
> {
  const { data, error } = await admin.rpc('finalize_instant_booking', {
    p_booking_id: bookingId,
    p_tenant_id: tenantId,
  });
  if (error || data == null) {
    if (error?.message.includes('slot_taken')) {
      return { error: 'That time was just taken. Choose another.', code: 'slot_taken' };
    }
    return { error: 'Could not confirm the visit. Please try again.', code: 'other' };
  }
  const payload = readFinalizePayload(data);
  if (!payload.visit_id) {
    return { error: 'Could not confirm the visit. Please try again.', code: 'other' };
  }
  return {
    finalized: payload.finalized === true,
    visitId: payload.visit_id,
    recurringRuleId: payload.recurring_rule_id ?? null,
  };
}

function readIntake(value: Json): BookingIntake | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  const addressLine1 = typeof row.addressLine1 === 'string' ? row.addressLine1 : '';
  const city = typeof row.city === 'string' ? row.city : '';
  const state = typeof row.state === 'string' ? row.state : '';
  const postalCode = typeof row.postalCode === 'string' ? row.postalCode : '';
  if (!addressLine1 || !city || !state || !postalCode) return null;
  const numberOrNull = (key: string) => (typeof row[key] === 'number' ? row[key] : null);
  return {
    addressLine1,
    city,
    state,
    postalCode,
    bedrooms: numberOrNull('bedrooms'),
    bathrooms: numberOrNull('bathrooms'),
    sqft: numberOrNull('sqft'),
    zoneId: typeof row.zoneId === 'string' ? row.zoneId : null,
    latitude: numberOrNull('latitude'),
    longitude: numberOrNull('longitude'),
    geocodeReason: typeof row.geocodeReason === 'string' ? row.geocodeReason : null,
    smsOptIn: row.smsOptIn === true,
  };
}

/** Creates or matches the customer only after the slot is held. */
export async function attachBookingCustomer(
  admin: Admin,
  tenantId: string,
  bookingId: string,
): Promise<{ customerId: string; propertyId: string } | { error: string }> {
  const { data: booking } = await admin
    .from('tenant_instant_bookings')
    .select('id, customer_id, property_id, customer_email, customer_phone, customer_name, intake')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!booking) return { error: 'Booking not found.' };
  if (booking.customer_id && booking.property_id) {
    return { customerId: booking.customer_id, propertyId: booking.property_id };
  }
  const intake = readIntake(booking.intake);
  if (!intake) return { error: 'Booking details are missing.' };

  const customer = await ensureBookingCustomer(admin, {
    tenantId,
    name: booking.customer_name,
    email: booking.customer_email,
    phone: booking.customer_phone,
    addressLine1: intake.addressLine1,
    city: intake.city,
    state: intake.state,
    postalCode: intake.postalCode,
    bedrooms: intake.bedrooms,
    bathrooms: intake.bathrooms,
    sqft: intake.sqft,
    zoneId: intake.zoneId,
    latitude: intake.latitude,
    longitude: intake.longitude,
    geocodeReason: intake.geocodeReason,
    smsOptIn: intake.smsOptIn,
  });
  if ('error' in customer) return customer;

  const { error } = await admin
    .from('tenant_instant_bookings')
    .update({ customer_id: customer.customerId, property_id: customer.propertyId })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId);
  if (error) return { error: 'Could not save your contact details.' };
  return customer;
}
