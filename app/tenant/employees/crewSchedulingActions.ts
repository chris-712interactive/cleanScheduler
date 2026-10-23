'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveGeocodedPoint } from '@/lib/geo/censusGeocode';
import { parseTagList } from '@/lib/schedule/optimizer/preferences';
import type { Database } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/server';
import {
  canEditMemberAvailability,
  canSetCrewSchedulingLimits,
} from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';

export interface CrewSchedulingActionState {
  error?: string;
  success?: boolean;
}

function optionalCap(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function checked(formData: FormData, name: string, allowed: Set<string>): string[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => String(value).trim())
        .filter((id) => allowed.has(id)),
    ),
  ];
}

const PROPERTY_KINDS = new Set(['residential', 'commercial', 'short_term_rental', 'other']);

export async function updateCrewSchedulingProfileAction(
  _prev: CrewSchedulingActionState,
  formData: FormData,
): Promise<CrewSchedulingActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  if (!slug || !targetUserId) return { error: 'Missing team member.' };

  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const membership = await requireTenantPortalAccess(
    slug,
    auth.user.id === targetUserId ? '/settings/account' : `/employees/${targetUserId}`,
  );
  const admin = createAdminClient();
  const { data: target } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) return { error: 'Team member not found.' };
  if (
    !canEditMemberAvailability({
      actor: membership.role,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole: target.role as TenantRole,
    })
  ) {
    return { error: 'You cannot edit this scheduling profile.' };
  }

  const [{ data: members }, { data: zones }, { data: existingHome }] = await Promise.all([
    admin
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true),
    admin.from('tenant_service_zones').select('id').eq('tenant_id', membership.tenantId),
    admin
      .from('tenant_member_scheduling_profiles')
      .select(
        'home_address_line1, home_city, home_state, home_postal_code, home_latitude, home_longitude, experience_level, max_jobs_per_day, max_minutes_per_day, max_drive_minutes, skill_tags, certification_tags, equipment_tags, attribute_tags, language_codes, property_kinds, handles_pets, handles_chemical_sensitivity, preferred_zone_ids, preferred_partner_ids, avoid_partner_ids',
      )
      .eq('tenant_id', membership.tenantId)
      .eq('user_id', targetUserId)
      .maybeSingle(),
  ]);
  const memberIds = new Set(
    (members ?? []).map((row) => row.user_id).filter((id) => id !== targetUserId),
  );
  const zoneIds = new Set((zones ?? []).map((row) => row.id));

  const home = {
    line1: String(formData.get('home_address_line1') ?? '').trim() || null,
    city: String(formData.get('home_city') ?? '').trim() || null,
    state: String(formData.get('home_state') ?? '').trim() || null,
    postalCode: String(formData.get('home_postal_code') ?? '').trim() || null,
  };
  const geocoded = await resolveGeocodedPoint(
    home,
    existingHome
      ? {
          line1: existingHome.home_address_line1,
          city: existingHome.home_city,
          state: existingHome.home_state,
          postalCode: existingHome.home_postal_code,
          latitude: existingHome.home_latitude,
          longitude: existingHome.home_longitude,
        }
      : null,
  );
  const mayEditOffice = canSetCrewSchedulingLimits(membership.role as TenantRole);
  const savedTags = (value: string[] | null | undefined) => value ?? [];
  const savedIds = (value: string[] | null | undefined, allowed: Set<string>) =>
    savedTags(value).filter((id) => allowed.has(id));
  const requestedExperience = String(formData.get('experience_level') ?? 'standard');
  const parsedExperience =
    requestedExperience === 'new' || requestedExperience === 'lead'
      ? requestedExperience
      : 'standard';
  const savedExperience = existingHome?.experience_level;
  const experienceLevel = mayEditOffice
    ? parsedExperience
    : savedExperience === 'new' || savedExperience === 'lead'
      ? savedExperience
      : 'standard';
  const maxJobsPerDay = mayEditOffice
    ? optionalCap(formData.get('max_jobs_per_day'), 1, 20)
    : (existingHome?.max_jobs_per_day ?? null);
  const maxMinutesPerDay = mayEditOffice
    ? optionalCap(formData.get('max_minutes_per_day'), 30, 960)
    : (existingHome?.max_minutes_per_day ?? null);
  const maxDriveMinutes = mayEditOffice
    ? optionalCap(formData.get('max_drive_minutes'), 5, 180)
    : (existingHome?.max_drive_minutes ?? null);
  const languageCodes = mayEditOffice
    ? parseTagList(String(formData.get('language_codes') ?? ''))
    : savedTags(existingHome?.language_codes);
  const preferredZoneIds = mayEditOffice
    ? checked(formData, 'preferred_zone_id', zoneIds)
    : savedIds(existingHome?.preferred_zone_ids, zoneIds);

  if (formData.get('profile_scope') === 'consultation') {
    const { error } = await admin.from('tenant_member_scheduling_profiles').upsert({
      tenant_id: membership.tenantId,
      user_id: targetUserId,
      language_codes: languageCodes,
      experience_level: experienceLevel,
      max_jobs_per_day: maxJobsPerDay,
      max_minutes_per_day: maxMinutesPerDay,
      max_drive_minutes: maxDriveMinutes,
      preferred_zone_ids: preferredZoneIds,
      home_address_line1: home.line1,
      home_city: home.city,
      home_state: home.state,
      home_postal_code: home.postalCode,
      home_latitude: geocoded.point?.lat ?? null,
      home_longitude: geocoded.point?.lng ?? null,
      home_geocode_reason: geocoded.reason,
    });
    if (error) return { error: 'Could not save the scheduling profile.' };
    revalidatePath(`/tenant/employees/${targetUserId}`, 'page');
    revalidatePath('/tenant/settings/account', 'page');
    revalidatePath('/tenant/schedule', 'page');
    return { success: true };
  }

  const row: Database['public']['Tables']['tenant_member_scheduling_profiles']['Insert'] = {
    tenant_id: membership.tenantId,
    user_id: targetUserId,
    skill_tags: mayEditOffice
      ? parseTagList(String(formData.get('skill_tags') ?? ''))
      : savedTags(existingHome?.skill_tags),
    certification_tags: mayEditOffice
      ? parseTagList(String(formData.get('certification_tags') ?? ''))
      : savedTags(existingHome?.certification_tags),
    equipment_tags: mayEditOffice
      ? parseTagList(String(formData.get('equipment_tags') ?? ''))
      : savedTags(existingHome?.equipment_tags),
    attribute_tags: mayEditOffice
      ? parseTagList(String(formData.get('attribute_tags') ?? ''))
      : savedTags(existingHome?.attribute_tags),
    language_codes: languageCodes,
    property_kinds: mayEditOffice
      ? checked(formData, 'property_kind', PROPERTY_KINDS)
      : savedIds(existingHome?.property_kinds, PROPERTY_KINDS),
    handles_pets: mayEditOffice
      ? formData.get('handles_pets') === 'on'
      : (existingHome?.handles_pets ?? true),
    handles_chemical_sensitivity: mayEditOffice
      ? formData.get('handles_chemical_sensitivity') === 'on'
      : (existingHome?.handles_chemical_sensitivity ?? true),
    experience_level: experienceLevel,
    max_jobs_per_day: maxJobsPerDay,
    max_minutes_per_day: maxMinutesPerDay,
    max_drive_minutes: maxDriveMinutes,
    preferred_zone_ids: preferredZoneIds,
    preferred_partner_ids: mayEditOffice
      ? checked(formData, 'preferred_partner_id', memberIds)
      : savedIds(existingHome?.preferred_partner_ids, memberIds),
    avoid_partner_ids: mayEditOffice
      ? checked(formData, 'avoid_partner_id', memberIds)
      : savedIds(existingHome?.avoid_partner_ids, memberIds),
    home_address_line1: home.line1,
    home_city: home.city,
    home_state: home.state,
    home_postal_code: home.postalCode,
    home_latitude: geocoded.point?.lat ?? null,
    home_longitude: geocoded.point?.lng ?? null,
    home_geocode_reason: geocoded.reason,
  };

  const { error } = await admin.from('tenant_member_scheduling_profiles').upsert(row);
  if (error) return { error: 'Could not save the scheduling profile.' };

  revalidatePath(`/tenant/employees/${targetUserId}`, 'page');
  revalidatePath('/tenant/settings/account', 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}
