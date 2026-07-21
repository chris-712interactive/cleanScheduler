'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

export interface ServiceZoneActionState {
  error?: string;
  success?: boolean;
}

function revalidateServiceZonePaths() {
  revalidatePath('/tenant/settings/service-zones', 'page');
  revalidatePath('/tenant/settings', 'page');
  revalidatePath('/tenant/customers', 'page');
}

export async function createTenantServiceZoneAction(
  _prev: ServiceZoneActionState,
  formData: FormData,
): Promise<ServiceZoneActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();

  if (!slug || !name) return { error: 'Zone name is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/service-zones');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage service zones.' };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('tenant_service_zones')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId);

  const { error } = await admin.from('tenant_service_zones').insert({
    tenant_id: membership.tenantId,
    name,
    sort_order: count ?? 0,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'A zone with that name already exists.' };
    }
    return { error: error.message };
  }

  revalidateServiceZonePaths();
  return { success: true };
}

export async function renameTenantServiceZoneAction(
  _prev: ServiceZoneActionState,
  formData: FormData,
): Promise<ServiceZoneActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const zoneId = String(formData.get('zone_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  if (!slug || !zoneId || !name) return { error: 'Zone name is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/service-zones');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage service zones.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_service_zones')
    .update({ name })
    .eq('tenant_id', membership.tenantId)
    .eq('id', zoneId);

  if (error) {
    if (error.code === '23505') {
      return { error: 'A zone with that name already exists.' };
    }
    return { error: error.message };
  }

  revalidateServiceZonePaths();
  return { success: true };
}

export async function toggleTenantServiceZoneAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const zoneId = String(formData.get('zone_id') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!slug || !zoneId) return;

  const membership = await requireTenantPortalAccess(slug, '/settings/service-zones');
  if (!canManageTeamInvitesAndRoles(membership.role)) return;

  const admin = createAdminClient();
  await admin
    .from('tenant_service_zones')
    .update({ is_active: enabled })
    .eq('tenant_id', membership.tenantId)
    .eq('id', zoneId);

  revalidateServiceZonePaths();
}

export async function deleteTenantServiceZoneAction(
  _prev: ServiceZoneActionState,
  formData: FormData,
): Promise<ServiceZoneActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const zoneId = String(formData.get('zone_id') ?? '').trim();
  if (!slug || !zoneId) return { error: 'Missing zone.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/service-zones');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage service zones.' };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('tenant_customer_properties')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId)
    .eq('service_zone_id', zoneId);

  if ((count ?? 0) > 0) {
    return {
      error: 'This zone is assigned to one or more properties. Reassign or clear them first.',
    };
  }

  const { error } = await admin
    .from('tenant_service_zones')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('id', zoneId);

  if (error) return { error: error.message };

  revalidateServiceZonePaths();
  return { success: true };
}
