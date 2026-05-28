'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

export interface LocationActionState {
  error?: string;
  success?: boolean;
}

export async function createTenantLocationAction(
  _prev: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();

  if (!slug || !name) return { error: 'Name is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/locations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage locations.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'multiLocationControls');
  } catch (error) {
    return { error: featureGateErrorMessage(error) ?? 'Upgrade to Pro to manage locations.' };
  }

  const { error } = await admin.from('tenant_locations').insert({
    tenant_id: membership.tenantId,
    name,
    code: code || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/locations', 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}

export async function toggleTenantLocationAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const locationId = String(formData.get('location_id') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!slug || !locationId) return;

  const membership = await requireTenantPortalAccess(slug, '/settings/locations');
  if (!canManageTeamInvitesAndRoles(membership.role)) return;

  const admin = createAdminClient();
  await admin
    .from('tenant_locations')
    .update({ is_active: enabled, updated_at: new Date().toISOString() })
    .eq('tenant_id', membership.tenantId)
    .eq('id', locationId);

  revalidatePath('/tenant/settings/locations', 'page');
  revalidatePath('/tenant/schedule', 'page');
}

export async function deleteTenantLocationAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const locationId = String(formData.get('location_id') ?? '').trim();
  if (!slug || !locationId) return;

  const membership = await requireTenantPortalAccess(slug, '/settings/locations');
  if (!canManageTeamInvitesAndRoles(membership.role)) return;

  const admin = createAdminClient();
  await admin
    .from('tenant_locations')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('id', locationId);

  revalidatePath('/tenant/settings/locations', 'page');
  revalidatePath('/tenant/schedule', 'page');
}
