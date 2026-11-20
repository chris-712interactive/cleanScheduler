'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  featureUpgradeMessage,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import { geocodeColumnsForAddress } from '@/lib/geo/ensurePropertyGeocoded';
import { canApplyStopOrder } from '@/lib/routing/locks';
import {
  isMissingRelationError,
  parseRouteEndKind,
  parseRouteStartKind,
  type RouteEndKind,
  type RouteStartKind,
} from '@/lib/routing/routeBases';

function splitRouteChoice(value: string): {
  kind: RouteStartKind | RouteEndKind | null;
  locationId: string;
} {
  if (value.startsWith('location:')) {
    return { kind: 'location', locationId: value.slice('location:'.length) };
  }
  const start = parseRouteStartKind(value);
  const end = parseRouteEndKind(value);
  return { kind: start ?? end, locationId: '' };
}
import { createAdminClient } from '@/lib/supabase/server';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';

export interface RouteStartState {
  error?: string;
  success?: string;
}

async function officeGate(
  slug: string,
): Promise<{ error: string } | { admin: ReturnType<typeof createAdminClient>; tenantId: string }> {
  const membership = await requireTenantPortalAccess(slug, '/schedule/starts');
  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'Sign in again to save a start location.' };
  const admin = createAdminClient();
  const { data: actor, error: actorError } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (actorError) return { error: 'Could not confirm your role.' };
  if (!canApplyStopOrder(actor?.role)) return { error: 'Only the office can set start locations.' };
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'multipleStartLocations')) {
    return { error: featureUpgradeMessage('multipleStartLocations') };
  }
  return { admin, tenantId: membership.tenantId };
}

export async function saveRouteLocationAction(
  _prev: RouteStartState,
  formData: FormData,
): Promise<RouteStartState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const label = String(formData.get('label') ?? '').trim();
  const line1 = String(formData.get('address_line1') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const postalCode = String(formData.get('postal_code') ?? '').trim();
  if (!slug || !label || !line1) return { error: 'Enter a name and a street address.' };
  if (label.length > 80) return { error: 'Use a shorter name.' };

  const gate = await officeGate(slug);
  if ('error' in gate) return { error: gate.error };

  let latitude: number | null = null;
  let longitude: number | null = null;
  let geocodeStatus: string | null = 'pending';
  let geocodeReason: string | null = null;
  try {
    const patch = await geocodeColumnsForAddress({
      line1,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
    });
    latitude = patch.latitude;
    longitude = patch.longitude;
    geocodeStatus = patch.geocode_status;
    geocodeReason = patch.geocode_reason;
  } catch (error) {
    console.error(
      '[routing] start location geocode failed:',
      error instanceof Error ? error.message : 'unknown',
    );
  }

  const { error } = await gate.admin.from('tenant_route_locations').insert({
    tenant_id: gate.tenantId,
    label,
    address_line1: line1,
    city: city || null,
    state: state || null,
    postal_code: postalCode || null,
    latitude,
    longitude,
    geocode_status: geocodeStatus,
    geocode_reason: geocodeReason,
  });
  if (error) {
    if (isMissingRelationError(error)) return { error: 'Start locations are not available yet.' };
    if (error.code === '23505') return { error: 'That name is already used.' };
    return { error: 'Could not save the start location.' };
  }
  revalidatePath('/schedule/starts', 'page');
  revalidatePath('/tenant/schedule/starts', 'page');
  return { success: 'Start location saved.' };
}

export async function saveCleanerBaseAction(
  _prev: RouteStartState,
  formData: FormData,
): Promise<RouteStartState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const userId = String(formData.get('user_id') ?? '').trim();
  const dateRaw = String(formData.get('service_date') ?? '').trim();
  const serviceDate = dateRaw && isCalendarDateKey(dateRaw) ? dateRaw : null;
  if (dateRaw && !serviceDate) return { error: 'Enter a valid day.' };
  const startChoice = splitRouteChoice(String(formData.get('start_choice') ?? ''));
  const endChoice = splitRouteChoice(String(formData.get('end_choice') ?? ''));
  const startKind =
    parseRouteStartKind(String(formData.get('start_kind') ?? '')) ?? startChoice.kind;
  const endKind = parseRouteEndKind(String(formData.get('end_kind') ?? '')) ?? endChoice.kind;
  const startLocationId =
    String(formData.get('start_location_id') ?? '').trim() || startChoice.locationId || null;
  const endLocationId =
    String(formData.get('end_location_id') ?? '').trim() || endChoice.locationId || null;
  if (!slug || !userId || !startKind || !endKind) return { error: 'Choose a start and an end.' };
  if (startKind === 'location' && !startLocationId) return { error: 'Choose a start place.' };
  if (endKind === 'location' && !endLocationId) return { error: 'Choose an end place.' };

  const gate = await officeGate(slug);
  if ('error' in gate) return { error: gate.error };

  const { data: member, error: memberError } = await gate.admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', gate.tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (memberError || !member) return { error: 'That cleaner is not on this workspace.' };

  if (startLocationId || endLocationId) {
    const ids = [startLocationId, endLocationId].filter((id): id is string => Boolean(id));
    const { data: places, error: placeError } = await gate.admin
      .from('tenant_route_locations')
      .select('id')
      .eq('tenant_id', gate.tenantId)
      .in('id', ids);
    if (placeError) {
      if (isMissingRelationError(placeError))
        return { error: 'Start locations are not available yet.' };
      return { error: 'Could not confirm the place.' };
    }
    if ((places ?? []).length !== new Set(ids).size) {
      return { error: 'That place is not on this workspace.' };
    }
  }

  const row = {
    tenant_id: gate.tenantId,
    user_id: userId,
    service_date: serviceDate,
    start_kind: startKind,
    start_location_id: startKind === 'location' ? startLocationId : null,
    end_kind: endKind,
    end_location_id: endKind === 'location' ? endLocationId : null,
  };

  const existing = gate.admin
    .from('tenant_cleaner_route_bases')
    .select('id')
    .eq('tenant_id', gate.tenantId)
    .eq('user_id', userId);
  const { data: prior, error: priorError } = serviceDate
    ? await existing.eq('service_date', serviceDate).maybeSingle()
    : await existing.is('service_date', null).maybeSingle();
  if (priorError) {
    if (isMissingRelationError(priorError))
      return { error: 'Start locations are not available yet.' };
    return { error: 'Could not save the start.' };
  }

  const write = prior
    ? gate.admin
        .from('tenant_cleaner_route_bases')
        .update(row)
        .eq('id', prior.id)
        .eq('tenant_id', gate.tenantId)
    : gate.admin.from('tenant_cleaner_route_bases').insert(row);
  const { error } = await write;
  if (error) {
    if (isMissingRelationError(error)) return { error: 'Start locations are not available yet.' };
    return { error: 'Could not save the start.' };
  }

  revalidatePath('/schedule', 'page');
  revalidatePath('/schedule/starts', 'page');
  revalidatePath('/schedule/map', 'page');
  return { success: serviceDate ? 'Saved for that day.' : 'Saved the default start.' };
}
