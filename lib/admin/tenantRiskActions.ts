'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import {
  setTenantAdminAccessSuspended,
  setTenantConnectChargesFrozen,
} from '@/lib/admin/tenantRiskControls';

export interface AdminTenantRiskFormState {
  error?: string;
  ok?: string;
}

async function requirePlatformAdmin(tenantSlug: string) {
  const auth = await requireAuth(`/tenants/${tenantSlug}`);
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }
  return auth;
}

async function resolveTenant(tenantId: string, tenantSlug: string) {
  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant || tenant.slug !== tenantSlug) {
    return null;
  }
  return tenant;
}

export async function suspendTenantAccessAction(
  _prev: AdminTenantRiskFormState,
  formData: FormData,
): Promise<AdminTenantRiskFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const auth = await requirePlatformAdmin(tenantSlug);
  const tenant = await resolveTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const admin = createAdminClient();
  const result = await setTenantAdminAccessSuspended(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    suspended: true,
    reason,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?risk=suspended`);
}

export async function unsuspendTenantAccessAction(
  _prev: AdminTenantRiskFormState,
  formData: FormData,
): Promise<AdminTenantRiskFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const auth = await requirePlatformAdmin(tenantSlug);
  const tenant = await resolveTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const admin = createAdminClient();
  const result = await setTenantAdminAccessSuspended(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    suspended: false,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?risk=unsuspended`);
}

export async function freezeTenantConnectChargesAction(
  _prev: AdminTenantRiskFormState,
  formData: FormData,
): Promise<AdminTenantRiskFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const auth = await requirePlatformAdmin(tenantSlug);
  const tenant = await resolveTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const admin = createAdminClient();
  const result = await setTenantConnectChargesFrozen(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    frozen: true,
    reason,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?risk=connect_frozen`);
}

export async function unfreezeTenantConnectChargesAction(
  _prev: AdminTenantRiskFormState,
  formData: FormData,
): Promise<AdminTenantRiskFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const auth = await requirePlatformAdmin(tenantSlug);
  const tenant = await resolveTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const admin = createAdminClient();
  const result = await setTenantConnectChargesFrozen(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    frozen: false,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?risk=connect_unfrozen`);
}
