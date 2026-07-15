'use server';

import { sendMarketingLeadNotificationEmail } from '@/lib/email/sendMarketingLeadNotification';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { createAdminClient } from '@/lib/supabase/server';

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
    .select('public_booking_request_enabled')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (ops && ops.public_booking_request_enabled === false) {
    return { error: 'This booking form is not available.' };
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
