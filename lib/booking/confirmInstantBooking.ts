import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  offerMatchesBookingSegment,
  parseBookingServiceAudience,
  resolveTenantBookingSegment,
} from '@/lib/booking/bookingAudience';
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
import type { PlaceHint } from '@/lib/schedule/optimizer/geo';
import { postal5 } from '@/lib/schedule/optimizer/geo';
import type { Database, Json } from '@/lib/supabase/database.types';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';

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

export function visibleInstantOffers(offers: InstantOfferRow[]): InstantOfferRow[] {
  const segment = resolveTenantBookingSegment();
  return offers.filter(
    (offer) =>
      offer.is_active &&
      offerMatchesBookingSegment(parseBookingServiceAudience(offer.audience), segment),
  );
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

  const visible = visibleInstantOffers([offer]);
  if (visible.length === 0) return { ok: false, error: 'That service is not available to book.' };

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

  const slot = loaded.slots.find(
    (candidate) =>
      candidate.startsAt === input.startsAt &&
      candidate.endsAt === input.endsAt &&
      candidate.assigneeUserId === input.assigneeUserId,
  );
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

async function findCustomerByEmail(
  admin: Admin,
  tenantId: string,
  email: string,
): Promise<string | null> {
  const { data: identities } = await admin
    .from('customer_identities')
    .select('id')
    .ilike('email', email)
    .limit(20);
  const identityIds = (identities ?? []).map((row) => row.id);
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
  },
): Promise<{ customerId: string; propertyId: string } | { error: string }> {
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
      sms_transactional_opt_in: Boolean(input.phone),
      sms_transactional_opt_in_at: input.phone ? new Date().toISOString() : null,
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
    await admin
      .from('tenant_customer_properties')
      .update({
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        sqft: input.sqft,
        service_zone_id: input.zoneId,
        latitude: input.latitude,
        longitude: input.longitude,
        geocode_reason: input.geocodeReason,
      })
      .eq('id', matched.id)
      .eq('tenant_id', input.tenantId);
    return { customerId, propertyId: matched.id };
  }

  const property = await admin
    .from('tenant_customer_properties')
    .insert({
      tenant_id: input.tenantId,
      customer_id: customerId,
      label: 'Booked online',
      property_kind: 'residential',
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

export async function holdInstantBooking(
  admin: Admin,
  input: {
    tenantId: string;
    prepared: PreparedInstantBooking;
    customerId: string;
    propertyId: string;
    email: string;
    phone: string | null;
    name: string;
    bufferMinutes: number;
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
    p_customer_id: input.customerId,
    p_property_id: input.propertyId,
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
  { finalized: boolean; visitId: string; recurringRuleId: string | null } | { error: string }
> {
  const { data, error } = await admin.rpc('finalize_instant_booking', {
    p_booking_id: bookingId,
    p_tenant_id: tenantId,
  });
  if (error || data == null) {
    if (error?.message.includes('hold_expired')) {
      return { error: 'That hold expired. Choose the time again.' };
    }
    if (error?.message.includes('slot_taken')) {
      return { error: 'That time was just taken. Choose another.' };
    }
    return { error: 'Could not confirm the visit. Please try again.' };
  }
  const payload = readFinalizePayload(data);
  if (!payload.visit_id) return { error: 'Could not confirm the visit. Please try again.' };
  return {
    finalized: payload.finalized === true,
    visitId: payload.visit_id,
    recurringRuleId: payload.recurring_rule_id ?? null,
  };
}
