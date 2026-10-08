'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { geocodeUsAddress } from '@/lib/geo/censusGeocode';
import { parseTagList } from '@/lib/schedule/optimizer/preferences';
import type { Database } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/server';
import { canEditMemberAvailability } from '@/lib/tenant/employeePermissions';
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

  const { data: members } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true);
  const { data: zones } = await admin
    .from('tenant_service_zones')
    .select('id')
    .eq('tenant_id', membership.tenantId);
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
  const point = await geocodeUsAddress(home);
  const experience = String(formData.get('experience_level') ?? 'standard');

  const row: Database['public']['Tables']['tenant_member_scheduling_profiles']['Insert'] = {
    tenant_id: membership.tenantId,
    user_id: targetUserId,
    skill_tags: parseTagList(String(formData.get('skill_tags') ?? '')),
    certification_tags: parseTagList(String(formData.get('certification_tags') ?? '')),
    equipment_tags: parseTagList(String(formData.get('equipment_tags') ?? '')),
    attribute_tags: parseTagList(String(formData.get('attribute_tags') ?? '')),
    language_codes: parseTagList(String(formData.get('language_codes') ?? '')),
    property_kinds: checked(formData, 'property_kind', PROPERTY_KINDS),
    handles_pets: formData.get('handles_pets') === 'on',
    handles_chemical_sensitivity: formData.get('handles_chemical_sensitivity') === 'on',
    experience_level: experience === 'new' || experience === 'lead' ? experience : 'standard',
    max_jobs_per_day: optionalCap(formData.get('max_jobs_per_day'), 1, 20),
    max_minutes_per_day: optionalCap(formData.get('max_minutes_per_day'), 30, 960),
    max_drive_minutes: optionalCap(formData.get('max_drive_minutes'), 5, 180),
    preferred_zone_ids: checked(formData, 'preferred_zone_id', zoneIds),
    preferred_partner_ids: checked(formData, 'preferred_partner_id', memberIds),
    avoid_partner_ids: checked(formData, 'avoid_partner_id', memberIds),
    home_address_line1: home.line1,
    home_city: home.city,
    home_state: home.state,
    home_postal_code: home.postalCode,
    home_latitude: point?.lat ?? null,
    home_longitude: point?.lng ?? null,
  };

  const { error } = await admin.from('tenant_member_scheduling_profiles').upsert(row);
  if (error) return { error: 'Could not save the scheduling profile.' };

  revalidatePath(`/tenant/employees/${targetUserId}`, 'page');
  revalidatePath('/tenant/settings/account', 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}
