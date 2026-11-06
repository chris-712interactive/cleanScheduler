'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertTenantFeatureEnabled } from '@/lib/billing/tenantFeatureGate';
import { parseCentsFromDollars } from '@/lib/billing/parseMoney';
import { parsePublicBookingMode, type PublicBookingMode } from '@/lib/booking/publicBookingMode';
import { normalizePostalList } from '@/lib/booking/serviceZoneMatch';
import type { InstantPricingMethod } from '@/lib/booking/priceInstantOffer';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  instantOfferServiceLine,
  instantPricingMethodAllowed,
  resolveTenantBookingSegment,
} from '@/lib/booking/bookingAudience';
import { loadTenantServiceSegment } from '@/lib/tenant/loadTenantServiceSegment';

export type BookingRequestSettingsState = {
  error?: string;
  success?: boolean;
};

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

async function requireBookingEditor(slug: string) {
  if (!slug) return { error: 'Workspace is required.' as const };
  const membership = await requireTenantPortalAccess(slug, '/settings/booking-requests');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can change booking settings.' as const };
  }
  const admin = createAdminClient();
  await assertTenantFeatureEnabled(admin, membership.tenantId, 'publicBookingRequest');
  return { admin, tenantId: membership.tenantId };
}

export async function updatePublicBookingRequestSettings(
  _prev: BookingRequestSettingsState,
  formData: FormData,
): Promise<BookingRequestSettingsState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const access = await requireBookingEditor(slug);
  if ('error' in access) return { error: access.error };

  const mode = parsePublicBookingMode(String(formData.get('public_booking_mode') ?? ''));
  if (!mode) return { error: 'Choose a booking mode.' };

  const stepRaw = clampInt(
    String(formData.get('instant_booking_slot_step_minutes') ?? ''),
    15,
    60,
    30,
  );
  const slotStep = stepRaw === 15 || stepRaw === 60 ? stepRaw : 30;
  const deposit = parseCentsFromDollars(
    String(formData.get('instant_booking_deposit_dollars') ?? ''),
  );

  const patch = {
    public_booking_mode: mode satisfies PublicBookingMode,
    public_booking_request_enabled: mode !== 'off',
    instant_booking_lead_time_hours: clampInt(
      String(formData.get('instant_booking_lead_time_hours') ?? ''),
      0,
      168,
      24,
    ),
    instant_booking_window_days: clampInt(
      String(formData.get('instant_booking_window_days') ?? ''),
      1,
      90,
      21,
    ),
    instant_booking_buffer_minutes: clampInt(
      String(formData.get('instant_booking_buffer_minutes') ?? ''),
      0,
      240,
      30,
    ),
    instant_booking_slot_step_minutes: slotStep,
    instant_booking_deposit_cents: deposit ?? 0,
    instant_booking_collect_card: formData.get('instant_booking_collect_card') === 'on',
    instant_booking_allow_recurring: formData.get('instant_booking_allow_recurring') === 'on',
    instant_booking_allow_weekly: formData.get('instant_booking_allow_weekly') === 'on',
    instant_booking_allow_biweekly: formData.get('instant_booking_allow_biweekly') === 'on',
    instant_booking_allow_monthly: formData.get('instant_booking_allow_monthly') === 'on',
    instant_booking_travel_mph: clampInt(
      String(formData.get('instant_booking_travel_mph') ?? ''),
      5,
      80,
      25,
    ),
  };

  const { data: existing } = await access.admin
    .from('tenant_operational_settings')
    .select('tenant_id')
    .eq('tenant_id', access.tenantId)
    .maybeSingle();

  const { error } = existing
    ? await access.admin
        .from('tenant_operational_settings')
        .update(patch)
        .eq('tenant_id', access.tenantId)
    : await access.admin.from('tenant_operational_settings').insert({
        tenant_id: access.tenantId,
        ...patch,
      });
  if (error) return { error: error.message };

  const { data: zones } = await access.admin
    .from('tenant_service_zones')
    .select('id')
    .eq('tenant_id', access.tenantId);

  for (const zone of zones ?? []) {
    const postalCodes = normalizePostalList(String(formData.get(`zone_postal_${zone.id}`) ?? ''));
    if (postalCodes.length === 0) {
      await access.admin
        .from('tenant_instant_booking_zone_coverage')
        .delete()
        .eq('tenant_id', access.tenantId)
        .eq('service_zone_id', zone.id);
      continue;
    }
    const { error: coverageError } = await access.admin
      .from('tenant_instant_booking_zone_coverage')
      .upsert(
        {
          tenant_id: access.tenantId,
          service_zone_id: zone.id,
          postal_codes: postalCodes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,service_zone_id' },
      );
    if (coverageError) return { error: coverageError.message };
  }

  revalidatePath('/settings/booking-requests');
  revalidatePath('/book');
  return { success: true };
}

function parsePricingMethod(raw: string): InstantPricingMethod {
  if (raw === 'per_sqft' || raw === 'beds_baths') return raw;
  return 'flat';
}

export async function saveInstantBookingOffer(
  _prev: BookingRequestSettingsState,
  formData: FormData,
): Promise<BookingRequestSettingsState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const access = await requireBookingEditor(slug);
  if ('error' in access) return { error: access.error };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Service name is required.' };

  const zoneIds = formData
    .getAll('zone_ids')
    .map((value) => String(value))
    .filter(Boolean);
  const planId = String(formData.get('service_plan_id') ?? '').trim() || null;
  const templateId = String(formData.get('service_template_id') ?? '').trim() || null;
  const base = parseCentsFromDollars(String(formData.get('base_dollars') ?? '')) ?? 0;
  const perSqft = parseCentsFromDollars(String(formData.get('per_sqft_dollars') ?? '')) ?? 0;
  const perBed = parseCentsFromDollars(String(formData.get('per_bedroom_dollars') ?? '')) ?? 0;
  const perBath = parseCentsFromDollars(String(formData.get('per_bathroom_dollars') ?? '')) ?? 0;

  const serviceSegment = await loadTenantServiceSegment(access.admin, access.tenantId);
  const pricingMethod = parsePricingMethod(String(formData.get('pricing_method') ?? ''));
  if (!instantPricingMethodAllowed(pricingMethod, serviceSegment)) {
    return {
      error:
        pricingMethod === 'per_sqft'
          ? 'Square-foot pricing is only for commercial cleaning.'
          : 'Beds and baths pricing is only for residential cleaning.',
    };
  }
  let templateJobType: string | null = null;
  if (templateId) {
    const { data: template } = await access.admin
      .from('tenant_service_templates')
      .select('job_type')
      .eq('id', templateId)
      .eq('tenant_id', access.tenantId)
      .maybeSingle();
    templateJobType = template?.job_type ?? null;
  }
  const line = instantOfferServiceLine({ pricingMethod, templateJobType });
  const audience =
    line === 'commercial'
      ? 'commercial'
      : line === 'residential'
        ? 'residential'
        : resolveTenantBookingSegment(serviceSegment);

  const row = {
    tenant_id: access.tenantId,
    name,
    duration_minutes: clampInt(String(formData.get('duration_minutes') ?? ''), 15, 720, 120),
    pricing_method: pricingMethod,
    base_amount_cents: base,
    per_sqft_cents: perSqft,
    per_bedroom_cents: perBed,
    per_bathroom_cents: perBath,
    service_plan_id: planId,
    service_template_id: templateId,
    zone_ids: zoneIds,
    audience,
    is_active: formData.get('is_active') === 'on',
  };

  const offerId = String(formData.get('offer_id') ?? '').trim();
  const { error } = offerId
    ? await access.admin
        .from('tenant_instant_booking_offers')
        .update(row)
        .eq('id', offerId)
        .eq('tenant_id', access.tenantId)
    : await access.admin.from('tenant_instant_booking_offers').insert(row);
  if (error) return { error: error.message };

  revalidatePath('/settings/booking-requests');
  revalidatePath('/book');
  return { success: true };
}

export async function deactivateInstantBookingOffer(
  _prev: BookingRequestSettingsState,
  formData: FormData,
): Promise<BookingRequestSettingsState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const access = await requireBookingEditor(slug);
  if ('error' in access) return { error: access.error };
  const offerId = String(formData.get('offer_id') ?? '').trim();
  if (!offerId) return { error: 'Missing service.' };
  const { error } = await access.admin
    .from('tenant_instant_booking_offers')
    .update({ is_active: false })
    .eq('id', offerId)
    .eq('tenant_id', access.tenantId);
  if (error) return { error: error.message };
  revalidatePath('/settings/booking-requests');
  revalidatePath('/book');
  return { success: true };
}
