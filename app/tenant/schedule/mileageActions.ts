'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import {
  preserveMiles,
  withAddedStop,
  type MileagePlaceKind,
  type MileageStop,
} from '@/lib/mileage/model';
import { parseLegsFromForm, parseOdometer, parseVehicle } from '@/lib/mileage/parseForm';
import {
  addMileagePlace,
  approveMileageDay,
  isWorkDate,
  fillMissingMiles,
  loadMileageDay,
  loadMileageSettings,
  saveMileageDay,
  stopFromPlace,
} from '@/lib/mileage/store';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';

export interface MileageActionState {
  error?: string;
  success?: string;
}

const PLACE_KINDS = new Set<MileagePlaceKind>(['event', 'supply', 'estimate', 'office', 'other']);

async function actorContext(slug: string, path: string) {
  const membership = await requireTenantPortalAccess(slug, path);
  const auth = await getAuthContext();
  const userId = auth?.user.id ?? '';
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  const role = membership.role as TenantRole;
  return { membership, userId, admin, permissions, role };
}

function canReview(
  role: TenantRole,
  permissions: Awaited<ReturnType<typeof resolveMembershipPermissions>>,
) {
  return role === 'owner' || role === 'admin' || hasPermission(permissions, 'mileage.review');
}

function canLogOwn(
  role: TenantRole,
  permissions: Awaited<ReturnType<typeof resolveMembershipPermissions>>,
) {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'employee' ||
    hasPermission(permissions, 'mileage.log')
  );
}

function revalidateMileage() {
  revalidatePath('/tenant/schedule', 'layout');
  revalidatePath('/tenant/schedule/miles', 'page');
  revalidatePath('/tenant/mileage', 'page');
}

export async function saveMileageDayAction(
  _prev: MileageActionState,
  formData: FormData,
): Promise<MileageActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };
  const workDate = String(formData.get('work_date') ?? '').trim();
  if (!isWorkDate(workDate)) return { error: 'Pick a valid day.' };

  const { membership, userId, admin, permissions, role } = await actorContext(
    slug,
    '/schedule/miles',
  );
  const targetUserId = String(formData.get('user_id') ?? userId).trim() || userId;
  const reviewingOther = targetUserId !== userId;
  if (reviewingOther && !canReview(role, permissions)) {
    return { error: 'You can only save your own miles.' };
  }
  if (!reviewingOther && !canLogOwn(role, permissions)) {
    return { error: 'Mileage is not turned on for this login.' };
  }

  const intent = String(formData.get('intent') ?? 'save');
  const timeZone = String(formData.get('time_zone') ?? 'America/New_York');
  let legs = parseLegsFromForm(formData);
  const settings = await loadMileageSettings(admin, membership.tenantId);

  if (intent === 'rebuild') {
    const fresh = await loadMileageDay({
      admin,
      tenantId: membership.tenantId,
      userId: targetUserId,
      workDate,
      timeZone,
      rebuild: true,
    });
    legs = fresh.legs;
  }

  if (intent === 'add_stop' || intent === 'add_place_stop') {
    const loaded = await loadMileageDay({
      admin,
      tenantId: membership.tenantId,
      userId: targetUserId,
      workDate,
      timeZone,
    });
    const anchor = loaded.legs[0]
      ? {
          label: loaded.legs[0].originLabel,
          address: loaded.legs[0].originAddress,
          kind: loaded.legs[0].originKind,
          visitId: null,
          lat: loaded.legs[0].originLat,
          lng: loaded.legs[0].originLng,
          checkInAway: false,
        }
      : await officeAnchor(admin, membership.tenantId);
    let stop: MileageStop | null = null;
    if (intent === 'add_place_stop') {
      const place = loaded.places.find(
        (item) => item.id === String(formData.get('place_id') ?? ''),
      );
      if (!place) return { error: 'Choose a saved place.' };
      stop = stopFromPlace(place);
    } else {
      const label = String(formData.get('stop_label') ?? '').trim();
      const address = String(formData.get('stop_address') ?? '').trim();
      const kindRaw = String(formData.get('stop_kind') ?? 'other');
      const kind = PLACE_KINDS.has(kindRaw as MileagePlaceKind)
        ? (kindRaw as MileagePlaceKind)
        : 'other';
      if (!label || !address) return { error: 'Add a name and an address for the stop.' };
      const geocoded = await lookupUsAddress({ line1: address, country: 'US' });
      stop = {
        label,
        address,
        kind,
        visitId: null,
        lat: geocoded.point?.lat ?? null,
        lng: geocoded.point?.lng ?? null,
        checkInAway: false,
      };
      if (formData.get('save_place') === 'on' && canLogOwn(role, permissions)) {
        await addMileagePlace({
          admin,
          tenantId: membership.tenantId,
          name: label,
          address,
          kind,
        });
      }
    }
    const base = legs.length > 0 ? legs : loaded.legs;
    legs = await fillMissingMiles(
      admin,
      membership.tenantId,
      preserveMiles(base, withAddedStop(base, stop, anchor, settings)),
    );
  }

  const saved = await saveMileageDay({
    admin,
    tenantId: membership.tenantId,
    userId: targetUserId,
    workDate,
    vehicle: parseVehicle(formData.get('vehicle')),
    odometerStart: parseOdometer(formData.get('odometer_start')),
    odometerEnd: parseOdometer(formData.get('odometer_end')),
    legs,
    confirm: intent === 'confirm',
  });
  if (saved.error) return saved;
  revalidateMileage();
  if (intent === 'confirm') return { success: 'Miles confirmed.' };
  if (intent === 'add_stop' || intent === 'add_place_stop') return { success: 'Stop added.' };
  return { success: 'Miles saved.' };
}

async function officeAnchor(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<MileageStop> {
  const { data: tenant } = await admin
    .from('tenants')
    .select('address_line1, city, state, postal_code, latitude, longitude')
    .eq('id', tenantId)
    .maybeSingle();
  const address = [tenant?.address_line1, tenant?.city, tenant?.state, tenant?.postal_code]
    .filter(Boolean)
    .join(', ');
  return {
    label: 'Office',
    address: address || 'Office',
    kind: 'office',
    visitId: null,
    lat: tenant?.latitude ?? null,
    lng: tenant?.longitude ?? null,
    checkInAway: false,
  };
}

export async function approveMileageDayAction(
  _prev: MileageActionState,
  formData: FormData,
): Promise<MileageActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const dayId = String(formData.get('day_id') ?? '').trim();
  if (!slug || !dayId) return { error: 'Missing day.' };
  const { membership, userId, admin, permissions, role } = await actorContext(slug, '/mileage');
  if (!canReview(role, permissions)) return { error: 'Only the office can approve miles.' };
  const result = await approveMileageDay({
    admin,
    tenantId: membership.tenantId,
    dayId,
    actorUserId: userId,
  });
  if (result.error) return result;
  revalidateMileage();
  return { success: 'Day approved.' };
}

export async function saveMileageSettingsAction(
  _prev: MileageActionState,
  formData: FormData,
): Promise<MileageActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };
  const { membership, admin, permissions, role } = await actorContext(slug, '/settings/operations');
  const canEdit =
    role === 'owner' ||
    role === 'admin' ||
    hasPermission(permissions, 'mileage.manage_settings') ||
    hasPermission(permissions, 'settings.operations');
  if (!canEdit) return { error: 'Only owners and admins can change mileage settings.' };

  const rateRaw = String(formData.get('mileage_rate_dollars') ?? '').trim();
  let rate: number | null = null;
  if (rateRaw) {
    const dollars = Number(rateRaw);
    if (!Number.isFinite(dollars) || dollars < 0 || dollars > 10) {
      return { error: 'Enter a rate between 0 and 10 dollars per mile.' };
    }
    rate = Math.round(dollars * 100);
  }
  const { error } = await admin
    .from('tenant_operational_settings')
    .update({
      mileage_reimbursement_enabled: formData.get('mileage_reimbursement_enabled') === 'on',
      mileage_rate_cents_per_mile: rate,
      mileage_ask_odometer: formData.get('mileage_ask_odometer') === 'on',
      mileage_count_commute_to_first: formData.get('mileage_count_commute_to_first') === 'on',
      mileage_count_return_home: formData.get('mileage_count_return_home') === 'on',
      mileage_count_between_stops: formData.get('mileage_count_between_stops') === 'on',
      mileage_count_office_legs: formData.get('mileage_count_office_legs') === 'on',
    })
    .eq('tenant_id', membership.tenantId);
  if (error) return { error: 'Could not save mileage settings.' };
  revalidatePath('/tenant/settings/operations', 'page');
  revalidateMileage();
  return { success: 'Mileage settings saved.' };
}
