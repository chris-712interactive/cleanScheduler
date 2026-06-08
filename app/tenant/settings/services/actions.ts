'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { parseCustomerPropertyKind } from '@/lib/tenant/quoteStructuredFields';
import { parseScheduleRole } from '@/lib/tenant/scheduleRoleLabels';

export interface ServiceTypeActionState {
  error?: string;
  success?: boolean;
}

function parseDurationHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value > 24) return null;
  return Math.round(value * 100) / 100;
}

export async function updateServiceTypeDurationAction(
  _prev: ServiceTypeActionState,
  formData: FormData,
): Promise<ServiceTypeActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const templateId = String(formData.get('template_id') ?? '').trim();
  const hoursRaw = String(formData.get('estimated_hours') ?? '');

  if (!slug || !templateId) return { error: 'Missing service type.' };

  const hours = parseDurationHours(hoursRaw);
  if (hours == null) return { error: 'Enter a valid duration between 0.25 and 24 hours.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/services');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can edit service types.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_service_templates')
    .update({ estimated_hours: hours })
    .eq('tenant_id', membership.tenantId)
    .eq('id', templateId)
    .eq('kind', 'service_line');

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/services', 'page');
  revalidatePath('/tenant/quotes', 'page');
  return { success: true };
}

export async function updateServiceTypeScheduleRoleAction(
  _prev: ServiceTypeActionState,
  formData: FormData,
): Promise<ServiceTypeActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const templateId = String(formData.get('template_id') ?? '').trim();
  const scheduleRole = parseScheduleRole(String(formData.get('schedule_role') ?? ''));

  if (!slug || !templateId || !scheduleRole) {
    return { error: 'Choose a valid schedule role.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/settings/services');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can edit service types.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_service_templates')
    .update({ schedule_role: scheduleRole })
    .eq('tenant_id', membership.tenantId)
    .eq('id', templateId)
    .eq('kind', 'service_line');

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/services', 'page');
  revalidatePath('/tenant/quotes', 'page');
  return { success: true };
}

export async function createCustomServiceTypeAction(
  _prev: ServiceTypeActionState,
  formData: FormData,
): Promise<ServiceTypeActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const serviceLabel = String(formData.get('service_label') ?? '').trim();
  const propertyKind = parseCustomerPropertyKind(String(formData.get('job_type') ?? ''));
  const hoursRaw = String(formData.get('estimated_hours') ?? '');
  const scheduleRole = parseScheduleRole(String(formData.get('schedule_role') ?? '')) ?? 'standard';

  if (!slug || serviceLabel.length < 2) {
    return { error: 'Enter a service name (at least 2 characters).' };
  }

  const hours = parseDurationHours(hoursRaw);
  if (hours == null) return { error: 'Enter a valid default duration in hours.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/services');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can add service types.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customServiceTypes');
  } catch (error) {
    return {
      error:
        featureGateErrorMessage(error) ??
        'Upgrade to Pro to create custom service types beyond the built-in library.',
    };
  }

  const { count } = await admin
    .from('tenant_service_templates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId)
    .eq('kind', 'service_line')
    .eq('is_system_default', false);

  if ((count ?? 0) >= 50) {
    return { error: 'Custom service type limit reached (50).' };
  }

  const { error } = await admin.from('tenant_service_templates').insert({
    tenant_id: membership.tenantId,
    kind: 'service_line',
    name: serviceLabel,
    service_label: serviceLabel,
    job_type: propertyKind as CustomerPropertyKind,
    estimated_hours: hours,
    schedule_role: scheduleRole,
    is_system_default: false,
    is_active: true,
    sort_order: 100,
  });

  if (error) {
    if (error.message.includes('tenant_service_templates_service_line_uidx')) {
      return { error: 'That service type already exists for this property kind.' };
    }
    return { error: error.message };
  }

  revalidatePath('/tenant/settings/services', 'page');
  revalidatePath('/tenant/quotes', 'page');
  return { success: true };
}

export async function deleteCustomServiceTypeAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const templateId = String(formData.get('template_id') ?? '').trim();
  if (!slug || !templateId) return;

  const membership = await requireTenantPortalAccess(slug, '/settings/services');
  if (!canManageTeamInvitesAndRoles(membership.role)) return;

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customServiceTypes');
  } catch {
    return;
  }

  await admin
    .from('tenant_service_templates')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('id', templateId)
    .eq('kind', 'service_line')
    .eq('is_system_default', false);

  revalidatePath('/tenant/settings/services', 'page');
  revalidatePath('/tenant/quotes', 'page');
}
