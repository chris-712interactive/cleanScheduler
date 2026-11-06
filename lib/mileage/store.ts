import type { SupabaseClient } from '@supabase/supabase-js';
import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import { fetchDrivingMiles } from '@/lib/mileage/drivingMiles';
import { checkInIsAwayFromStop } from '@/lib/mileage/checkInDistance';
import type { MileageYearDayRecord } from '@/lib/mileage/yearReport';
import {
  addDateKey,
  chooseLegMiles,
  countedMiles,
  DEFAULT_MILEAGE_SETTINGS,
  mondayOf,
  mileageApprovalRequired,
  pairKey,
  pairStops,
  reimbursementCents,
  type MileageDayStatus,
  type MileageLegDraft,
  type MileagePlaceKind,
  type MileageSettings,
  type MileageStop,
  type MileageVehicle,
} from '@/lib/mileage/model';
import {
  calendarDateKeyInTimeZone,
  visitTouchesCalendarDayInTimeZone,
} from '@/lib/datetime/tenantCalendarDay';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { dbOverlapRangeForQuery } from '@/lib/tenant/scheduleDateRange';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export type MileagePlaceOption = {
  id: string;
  name: string;
  address: string;
  kind: MileagePlaceKind;
  lat: number | null;
  lng: number | null;
};

export type MileageDayView = {
  dayId: string | null;
  userId: string;
  personName: string;
  workDate: string;
  status: MileageDayStatus;
  vehicle: MileageVehicle;
  odometerStart: number | null;
  odometerEnd: number | null;
  note: string | null;
  legs: MileageLegDraft[];
  places: MileagePlaceOption[];
  settings: MileageSettings;
  locked: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isWorkDate(value: string): boolean {
  return DATE_RE.test(value);
}

export async function loadMileageSettings(
  admin: Admin,
  tenantId: string,
): Promise<MileageSettings> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select(
      'mileage_reimbursement_enabled, mileage_rate_cents_per_mile, mileage_ask_odometer, mileage_count_commute_to_first, mileage_count_return_home, mileage_count_between_stops, mileage_count_office_legs',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_MILEAGE_SETTINGS };
  return {
    reimbursementEnabled: data.mileage_reimbursement_enabled,
    rateCentsPerMile: data.mileage_rate_cents_per_mile,
    askOdometer: data.mileage_ask_odometer,
    countCommuteToFirst: data.mileage_count_commute_to_first,
    countReturnHome: data.mileage_count_return_home,
    countBetweenStops: data.mileage_count_between_stops,
    countOfficeLegs: data.mileage_count_office_legs,
  };
}

async function personName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from('user_profiles')
    .select('display_name, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();
  const named = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
  return data?.display_name?.trim() || named || 'Team member';
}

function legFromRow(
  row: Database['public']['Tables']['tenant_mileage_legs']['Row'],
): MileageLegDraft {
  return {
    originLabel: row.origin_label,
    originAddress: row.origin_label,
    originKind: row.origin_kind,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    destLabel: row.dest_label,
    destAddress: row.dest_label,
    destKind: row.dest_kind,
    destLat: row.dest_lat,
    destLng: row.dest_lng,
    visitId: row.visit_id,
    included: row.included,
    miles: row.miles,
    source: row.source,
    checkInAway: row.check_in_away,
  };
}

async function loadPlaces(admin: Admin, tenantId: string): Promise<MileagePlaceOption[]> {
  const { data } = await admin
    .from('tenant_mileage_places')
    .select('id, name, address, kind, latitude, longitude')
    .eq('tenant_id', tenantId)
    .order('name');
  return (data ?? []).map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    kind: place.kind,
    lat: place.latitude,
    lng: place.longitude,
  }));
}

async function savedMilesFor(
  admin: Admin,
  tenantId: string,
  legs: MileageLegDraft[],
): Promise<Map<string, number>> {
  const keys = legs.map(pairKey);
  const originKeys = [...new Set(keys.map((key) => key.split('|')[0] ?? ''))];
  if (originKeys.length === 0) return new Map();
  const { data } = await admin
    .from('tenant_mileage_segments')
    .select('origin_key, dest_key, miles')
    .eq('tenant_id', tenantId)
    .in('origin_key', originKeys);
  const saved = new Map<string, number>();
  for (const row of data ?? []) {
    saved.set(`${row.origin_key}|${row.dest_key}`, Number(row.miles));
  }
  return saved;
}

export async function fillMissingMiles(
  admin: Admin,
  tenantId: string,
  legs: MileageLegDraft[],
): Promise<MileageLegDraft[]> {
  const saved = await savedMilesFor(admin, tenantId, legs);
  const suggested = new Map<string, number>();
  for (const leg of legs) {
    if (leg.miles != null) continue;
    const key = pairKey(leg);
    if (saved.has(key)) continue;
    if (
      leg.originLat == null ||
      leg.originLng == null ||
      leg.destLat == null ||
      leg.destLng == null
    ) {
      continue;
    }
    const miles = await fetchDrivingMiles(
      { lat: leg.originLat, lng: leg.originLng },
      { lat: leg.destLat, lng: leg.destLng },
    );
    if (miles != null) suggested.set(key, miles);
  }
  return legs.map((leg) => {
    if (leg.miles != null) return leg;
    const chosen = chooseLegMiles({
      savedMiles: saved.get(pairKey(leg)) ?? null,
      suggestedMiles: suggested.get(pairKey(leg)) ?? null,
      typedMiles: null,
      typedEdited: false,
    });
    return { ...leg, miles: chosen.miles, source: chosen.source };
  });
}

async function suggestLegs(
  admin: Admin,
  tenantId: string,
  userId: string,
  workDate: string,
  timeZone: string,
  settings: MileageSettings,
): Promise<MileageLegDraft[]> {
  const [{ data: tenant }, { data: home }] = await Promise.all([
    admin
      .from('tenants')
      .select('address_line1, city, state, postal_code, latitude, longitude')
      .eq('id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_member_scheduling_profiles')
      .select(
        'home_address_line1, home_city, home_state, home_postal_code, home_latitude, home_longitude',
      )
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const range = dbOverlapRangeForQuery('day', workDate);
  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id, title, starts_at, ends_at, status, check_in_lat, check_in_lng,
      tenant_scheduled_visit_assignees(user_id),
      tenant_customer_properties(address_line1, address_line2, city, state, postal_code, latitude, longitude)
    `,
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .lt('starts_at', range.end)
    .gt('ends_at', range.start);

  const stops: MileageStop[] = [];
  const homeAddress = formatPropertyAddressLine({
    address_line1: home?.home_address_line1,
    city: home?.home_city,
    state: home?.home_state,
    postal_code: home?.home_postal_code,
  });
  if (homeAddress || home?.home_latitude != null) {
    stops.push({
      label: 'Home',
      address: homeAddress || 'Home',
      kind: 'home',
      visitId: null,
      lat: home?.home_latitude ?? null,
      lng: home?.home_longitude ?? null,
      checkInAway: false,
    });
  }

  const assigned = (visits ?? [])
    .filter((visit) =>
      (visit.tenant_scheduled_visit_assignees ?? []).some((row) => row.user_id === userId),
    )
    .filter((visit) => visitTouchesCalendarDayInTimeZone(visit, workDate, timeZone))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  for (const visit of assigned) {
    const property = visit.tenant_customer_properties;
    const address = formatPropertyAddressLine(property) || visit.title?.trim() || 'Job';
    const point = { lat: property?.latitude ?? null, lng: property?.longitude ?? null };
    stops.push({
      label: address,
      address,
      kind: 'visit',
      visitId: visit.id,
      lat: point.lat,
      lng: point.lng,
      checkInAway: checkInIsAwayFromStop(point, {
        lat: visit.check_in_lat,
        lng: visit.check_in_lng,
      }),
    });
  }

  const firstHome = stops[0];
  if (firstHome?.kind === 'home') {
    stops.push({ ...firstHome, checkInAway: false });
  } else if (assigned.length === 0 && tenant) {
    const officeAddress =
      formatPropertyAddressLine({
        address_line1: tenant.address_line1,
        city: tenant.city,
        state: tenant.state,
        postal_code: tenant.postal_code,
      }) || 'Office';
    stops.push({
      label: 'Office',
      address: officeAddress,
      kind: 'office',
      visitId: null,
      lat: tenant.latitude,
      lng: tenant.longitude,
      checkInAway: false,
    });
  }

  const legs = pairStops(stops, settings);
  return fillMissingMiles(admin, tenantId, legs);
}

export async function loadMileageDay(params: {
  admin: Admin;
  tenantId: string;
  userId: string;
  workDate: string;
  timeZone: string;
  rebuild?: boolean;
}): Promise<MileageDayView> {
  const settings = await loadMileageSettings(params.admin, params.tenantId);
  const [name, places] = await Promise.all([
    personName(params.admin, params.userId),
    loadPlaces(params.admin, params.tenantId),
  ]);
  const { data: day } = await params.admin
    .from('tenant_mileage_days')
    .select('id, status, vehicle, odometer_start, odometer_end, note')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('work_date', params.workDate)
    .maybeSingle();

  let storedLegs: MileageLegDraft[] = [];
  if (day?.id) {
    const { data: legRows } = await params.admin
      .from('tenant_mileage_legs')
      .select('*')
      .eq('day_id', day.id)
      .order('sequence');
    storedLegs = (legRows ?? []).map(legFromRow);
  }
  const useStored = Boolean(day) && storedLegs.length > 0 && !params.rebuild;
  const legs = useStored
    ? storedLegs
    : await suggestLegs(
        params.admin,
        params.tenantId,
        params.userId,
        params.workDate,
        params.timeZone,
        settings,
      );

  return {
    dayId: day?.id ?? null,
    userId: params.userId,
    personName: name,
    workDate: params.workDate,
    status: day?.status ?? 'draft',
    vehicle: day?.vehicle ?? 'personal',
    odometerStart: day?.odometer_start ?? null,
    odometerEnd: day?.odometer_end ?? null,
    note: day?.note ?? null,
    legs,
    places,
    settings,
    locked: day?.status === 'approved',
  };
}

export async function saveMileageDay(params: {
  admin: Admin;
  tenantId: string;
  userId: string;
  workDate: string;
  vehicle: MileageVehicle;
  odometerStart: number | null;
  odometerEnd: number | null;
  legs: MileageLegDraft[];
  confirm: boolean;
}): Promise<{ error?: string }> {
  const settings = await loadMileageSettings(params.admin, params.tenantId);
  if (
    params.odometerStart != null &&
    params.odometerEnd != null &&
    params.odometerEnd < params.odometerStart
  ) {
    return { error: 'Ending odometer has to be the same or higher than the start.' };
  }
  const counted = countedMiles(params.legs);
  const amount = reimbursementCents({
    settings,
    vehicle: params.vehicle,
    counted,
  });
  const { data: existing } = await params.admin
    .from('tenant_mileage_days')
    .select('id, status')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('work_date', params.workDate)
    .maybeSingle();
  if (existing?.status === 'approved') {
    return { error: 'This day is already approved.' };
  }

  const now = new Date().toISOString();
  const status = params.confirm ? 'confirmed' : 'draft';
  const row = {
    tenant_id: params.tenantId,
    user_id: params.userId,
    work_date: params.workDate,
    status: status as MileageDayStatus,
    vehicle: params.vehicle,
    odometer_start: settings.askOdometer ? params.odometerStart : null,
    odometer_end: settings.askOdometer ? params.odometerEnd : null,
    counted_miles: counted,
    reimbursement_cents: amount,
    confirmed_at: params.confirm ? now : null,
    updated_at: now,
  };

  let dayId = existing?.id ?? null;
  if (dayId) {
    const { error } = await params.admin.from('tenant_mileage_days').update(row).eq('id', dayId);
    if (error) return { error: 'Could not save this day.' };
    await params.admin.from('tenant_mileage_legs').delete().eq('day_id', dayId);
  } else {
    const { data, error } = await params.admin
      .from('tenant_mileage_days')
      .insert(row)
      .select('id')
      .single();
    if (error || !data) return { error: 'Could not save this day.' };
    dayId = data.id;
  }

  if (params.legs.length > 0) {
    const { error } = await params.admin.from('tenant_mileage_legs').insert(
      params.legs.map((leg, sequence) => ({
        day_id: dayId,
        tenant_id: params.tenantId,
        sequence,
        origin_label: leg.originLabel,
        origin_kind: leg.originKind,
        origin_lat: leg.originLat,
        origin_lng: leg.originLng,
        dest_label: leg.destLabel,
        dest_kind: leg.destKind,
        dest_lat: leg.destLat,
        dest_lng: leg.destLng,
        visit_id: leg.visitId,
        included: leg.included,
        miles: leg.miles,
        source: params.confirm && leg.miles != null ? 'saved' : leg.source,
        check_in_away: leg.checkInAway,
      })),
    );
    if (error) return { error: 'Could not save the drives.' };
  }

  if (params.confirm) {
    for (const leg of params.legs) {
      if (leg.miles == null) continue;
      const [originKey, destKey] = pairKey(leg).split('|');
      if (!originKey || !destKey) continue;
      await params.admin.from('tenant_mileage_segments').upsert(
        {
          tenant_id: params.tenantId,
          origin_key: originKey,
          dest_key: destKey,
          miles: leg.miles,
        },
        { onConflict: 'tenant_id,origin_key,dest_key' },
      );
    }
  }
  return {};
}

export async function approveMileageDay(params: {
  admin: Admin;
  tenantId: string;
  dayId: string;
  actorUserId: string;
}): Promise<{ error?: string }> {
  const settings = await loadMileageSettings(params.admin, params.tenantId);
  if (!mileageApprovalRequired(settings)) {
    return { error: 'Approval is only used when the company reimburses mileage.' };
  }
  const { error } = await params.admin
    .from('tenant_mileage_days')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: params.actorUserId,
    })
    .eq('id', params.dayId)
    .eq('tenant_id', params.tenantId)
    .eq('status', 'confirmed');
  if (error) return { error: 'Could not approve this day.' };
  return {};
}

export async function addMileagePlace(params: {
  admin: Admin;
  tenantId: string;
  name: string;
  address: string;
  kind: MileagePlaceKind;
}): Promise<{ error?: string }> {
  const geocoded = await lookupUsAddress({
    line1: params.address,
    country: 'US',
  });
  const { error } = await params.admin.from('tenant_mileage_places').insert({
    tenant_id: params.tenantId,
    name: params.name,
    address: params.address,
    kind: params.kind,
    latitude: geocoded.point?.lat ?? null,
    longitude: geocoded.point?.lng ?? null,
  });
  if (error) return { error: 'Could not save that place.' };
  return {};
}

export function stopFromPlace(place: MileagePlaceOption): MileageStop {
  return {
    label: place.name,
    address: place.address,
    kind: place.kind === 'home' ? 'other' : place.kind,
    visitId: null,
    lat: place.lat,
    lng: place.lng,
    checkInAway: false,
  };
}

export async function yesterdayNeedsConfirm(params: {
  admin: Admin;
  tenantId: string;
  userId: string;
  todayKey: string;
  timeZone: string;
}): Promise<boolean> {
  const yesterday = addDateKey(params.todayKey, -1);
  const { data } = await params.admin
    .from('tenant_mileage_days')
    .select('status')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('work_date', yesterday)
    .maybeSingle();
  if (data?.status === 'confirmed' || data?.status === 'approved') return false;
  if (data?.status === 'draft') return true;
  const range = dbOverlapRangeForQuery('day', yesterday);
  const { data: visits } = await params.admin
    .from('tenant_scheduled_visits')
    .select('id, starts_at, ends_at, tenant_scheduled_visit_assignees(user_id)')
    .eq('tenant_id', params.tenantId)
    .neq('status', 'cancelled')
    .lt('starts_at', range.end)
    .gt('ends_at', range.start)
    .limit(40);
  return (visits ?? []).some(
    (visit) =>
      (visit.tenant_scheduled_visit_assignees ?? []).some((row) => row.user_id === params.userId) &&
      visitTouchesCalendarDayInTimeZone(visit, yesterday, params.timeZone),
  );
}

export async function loadMileageWeek(params: {
  admin: Admin;
  tenantId: string;
  anchorDate: string;
}): Promise<{
  weekStart: string;
  days: {
    id: string;
    userId: string;
    personName: string;
    workDate: string;
    status: MileageDayStatus;
    vehicle: MileageVehicle;
    countedMiles: number;
    reimbursementCents: number | null;
  }[];
}> {
  const weekStart = mondayOf(params.anchorDate);
  const weekEnd = addDateKey(weekStart, 6);
  const { data } = await params.admin
    .from('tenant_mileage_days')
    .select('id, user_id, work_date, status, vehicle, counted_miles, reimbursement_cents')
    .eq('tenant_id', params.tenantId)
    .gte('work_date', weekStart)
    .lte('work_date', weekEnd)
    .order('work_date');
  const userIds = [...new Set((data ?? []).map((row) => row.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await params.admin
      .from('user_profiles')
      .select('user_id, display_name, first_name, last_name')
      .in('user_id', userIds);
    for (const profile of profiles ?? []) {
      const named = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
      names.set(profile.user_id, profile.display_name?.trim() || named || 'Team member');
    }
  }
  return {
    weekStart,
    days: (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      personName: names.get(row.user_id) ?? 'Team member',
      workDate: row.work_date,
      status: row.status,
      vehicle: row.vehicle,
      countedMiles: Number(row.counted_miles),
      reimbursementCents: row.reimbursement_cents,
    })),
  };
}

export async function loadVisitDrive(params: {
  admin: Admin;
  tenantId: string;
  visitId: string;
}): Promise<{ miles: number; cents: number | null } | null> {
  const { data: legs } = await params.admin
    .from('tenant_mileage_legs')
    .select('miles, included, day_id')
    .eq('tenant_id', params.tenantId)
    .eq('visit_id', params.visitId)
    .eq('included', true);
  if (!legs || legs.length === 0) return null;
  const dayIds = [...new Set(legs.map((leg) => leg.day_id))];
  const { data: days } = await params.admin
    .from('tenant_mileage_days')
    .select('id, status, reimbursement_cents, counted_miles')
    .in('id', dayIds)
    .in('status', ['confirmed', 'approved']);
  const openDays = new Map((days ?? []).map((day) => [day.id, day]));
  let miles = 0;
  let cents = 0;
  let anyPay = false;
  for (const leg of legs) {
    const day = openDays.get(leg.day_id);
    if (!day || leg.miles == null) continue;
    const legMiles = Number(leg.miles);
    miles += legMiles;
    if (day.reimbursement_cents != null && Number(day.counted_miles) > 0) {
      anyPay = true;
      cents += Math.round(day.reimbursement_cents * (legMiles / Number(day.counted_miles)));
    }
  }
  if (miles <= 0) return null;
  return { miles: Math.round(miles * 10) / 10, cents: anyPay ? cents : null };
}

export async function loadMileageYear(params: {
  admin: Admin;
  tenantId: string;
  userId: string;
  year: number;
}): Promise<{ personName: string; days: MileageYearDayRecord[] }> {
  const name = await personName(params.admin, params.userId);
  const from = `${params.year}-01-01`;
  const to = `${params.year}-12-31`;
  const { data: dayRows } = await params.admin
    .from('tenant_mileage_days')
    .select('id, work_date, vehicle, odometer_start, odometer_end')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .gte('work_date', from)
    .lte('work_date', to)
    .in('status', ['confirmed', 'approved'])
    .order('work_date')
    .limit(400);
  const days = dayRows ?? [];
  const dayIds = days.map((day) => day.id);
  const legsByDay = new Map<string, MileageYearDayRecord['legs']>();
  if (dayIds.length > 0) {
    const { data: legRows } = await params.admin
      .from('tenant_mileage_legs')
      .select('day_id, sequence, origin_label, dest_label, miles, included')
      .eq('tenant_id', params.tenantId)
      .in('day_id', dayIds)
      .order('sequence')
      .limit(10000);
    for (const leg of legRows ?? []) {
      const list = legsByDay.get(leg.day_id) ?? [];
      list.push({
        originLabel: leg.origin_label,
        destLabel: leg.dest_label,
        miles: leg.miles == null ? null : Number(leg.miles),
        included: leg.included,
      });
      legsByDay.set(leg.day_id, list);
    }
  }
  return {
    personName: name,
    days: days.map((day) => ({
      workDate: day.work_date,
      vehicle: day.vehicle,
      odometerStart: day.odometer_start == null ? null : Number(day.odometer_start),
      odometerEnd: day.odometer_end == null ? null : Number(day.odometer_end),
      legs: legsByDay.get(day.id) ?? [],
    })),
  };
}

export function weekExportWindow(anchorDate: string): { from: string; to: string } {
  const from = mondayOf(anchorDate);
  return { from, to: addDateKey(from, 6) };
}

export function todayKey(timeZone: string): string {
  return calendarDateKeyInTimeZone(timeZone);
}
