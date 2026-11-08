'use server';

import { sendMarketingLeadNotificationEmail } from '@/lib/email/sendMarketingLeadNotification';
import { headers } from 'next/headers';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { bookingChallengeError } from '@/lib/booking/bookingChallenge';
import {
  instantBookingPlacesVisit,
  rateLimitAllows,
  trustedClientIp,
} from '@/lib/booking/bookingGuards';
import {
  PUBLIC_BOOKING_UNAVAILABLE,
  publicBookingModeError,
  publicBookingModeFromRow,
} from '@/lib/booking/publicBookingMode';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { loadTenantSegmentCapabilities } from '@/lib/tenant/loadTenantServiceSegment';
import { bookingServiceAllowed, bookingServiceDeniedMessage } from '@/lib/tenant/serviceSegment';

export type BookingRequestActionState = {
  error?: string;
  success?: boolean;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export async function submitBookingRequestAction(
  _prev: BookingRequestActionState,
  formData: FormData,
): Promise<BookingRequestActionState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const honeypot = String(formData.get('company') ?? '').trim();
  if (honeypot) {
    return { success: true };
  }

  const challenge = await bookingChallengeError(formData);
  if (challenge) return { error: challenge };

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const message = String(formData.get('message') ?? '').trim() || null;
  const preferredDate = String(formData.get('preferred_date') ?? '').trim() || null;
  const serviceInterest = String(formData.get('service_interest') ?? '').trim() || null;
  const preferredTimeRaw = String(formData.get('preferred_time_window') ?? '').trim();
  const preferredTimeWindow =
    preferredTimeRaw === 'morning' ||
    preferredTimeRaw === 'afternoon' ||
    preferredTimeRaw === 'evening' ||
    preferredTimeRaw === 'flexible'
      ? preferredTimeRaw
      : null;
  const addressLine1 = String(formData.get('address_line1') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;
  const state = String(formData.get('state') ?? '').trim() || null;
  const postalCode = String(formData.get('postal_code') ?? '').trim() || null;

  if (!tenantSlug || !name || !email || !message) {
    return { error: 'Name, email, and message are required.' };
  }

  const portal = await getPortalContext();
  if (portal.kind !== 'site' || portal.tenantSlug !== tenantSlug) {
    return { error: PUBLIC_BOOKING_UNAVAILABLE };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, business_email, name, slug')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (!tenant) {
    return { error: 'This booking form is not available.' };
  }

  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'publicBookingRequest')) {
    return { error: 'This booking form is not available.' };
  }

  const { data: ops } = await admin
    .from('tenant_operational_settings')
    .select(
      'public_booking_mode, public_booking_request_enabled, instant_booking_deposit_cents, instant_booking_collect_card',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const mode = publicBookingModeFromRow(ops);
  const requestWhileCardRequired =
    mode === 'instant' &&
    !instantBookingPlacesVisit({
      depositCents: ops?.instant_booking_deposit_cents ?? 0,
      collectCard: Boolean(ops?.instant_booking_collect_card),
    });
  const modeError = publicBookingModeError(mode, 'request');
  if (modeError && !requestWhileCardRequired) return { error: modeError };

  // Instant-booking work should keep using bookingServiceAllowed so a booking-mode
  // setting and this service segment stay independent checks.
  const capabilities = await loadTenantSegmentCapabilities(admin, tenant.id);
  if (!bookingServiceAllowed(capabilities, serviceInterest)) {
    return { error: bookingServiceDeniedMessage() };
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('tenant_marketing_leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('email', email)
    .gte('created_at', since);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const headerList = await headers();
  const { data: hits, error: limitError } = await admin.rpc('consume_public_rate_limit', {
    p_scope: 'booking_request',
    p_client_key: trustedClientIp(headerList),
    p_limit: RATE_LIMIT_MAX,
    p_window_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  });
  if (limitError || typeof hits !== 'number' || !rateLimitAllows(hits, RATE_LIMIT_MAX)) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const preferredNote = preferredDate ? `Preferred date: ${preferredDate}` : null;
  const timeNote = preferredTimeWindow ? `Preferred time: ${preferredTimeWindow}` : null;
  const serviceNote = serviceInterest ? `Service interest: ${serviceInterest}` : null;
  const fullMessage = [message, serviceNote, preferredNote, timeNote].filter(Boolean).join('\n\n');

  const { error: insertError } = await admin.from('tenant_marketing_leads').insert({
    tenant_id: tenant.id,
    page_id: null,
    source: 'quote_request',
    name,
    email,
    phone,
    message: fullMessage,
    service_address_line1: addressLine1,
    service_city: city,
    service_state: state,
    service_postal_code: postalCode,
    service_interest: serviceInterest,
    preferred_time_window: preferredTimeWindow,
    status: 'new',
  });

  if (insertError) {
    return { error: 'Could not submit your request. Please try again.' };
  }

  const notifyEmail =
    (
      await admin
        .from('tenant_marketing_site_settings')
        .select('contact_email')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
    ).data?.contact_email?.trim() ||
    tenant.business_email?.trim() ||
    null;

  if (notifyEmail) {
    await sendMarketingLeadNotificationEmail({
      to: notifyEmail,
      tenantName: String(tenant.name ?? tenant.slug),
      leadName: name,
      leadEmail: email,
      leadPhone: phone,
      message: fullMessage,
    });
  }

  return { success: true };
}
