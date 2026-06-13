'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { assertTenantFeatureEnabled } from '@/lib/billing/tenantFeatureGate';
import {
  isPermissionKey,
  PERMISSION_KEYS,
  type PermissionKey,
} from '@/lib/tenant/permissionCatalog';
import {
  assertPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import type { TenantRole } from '@/lib/auth/types';
import { assertTeamRecoveryAccessRemains } from '@/lib/tenant/workspaceAdminGuards';

const SYSTEM_SLUGS = new Set(['owner', 'admin', 'employee', 'viewer']);
const BASE_ROLES = new Set<TenantRole>(['admin', 'employee', 'viewer']);

function returnToWithError(returnTo: string, code: string): string {
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${code}`;
}

function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function parsePermissionKeys(formData: FormData): PermissionKey[] {
  const raw = formData.getAll('permission_key').map((value) => String(value));
  return raw.filter((value): value is PermissionKey => isPermissionKey(value));
}

async function assertCanManageRoles(tenantSlug: string, returnTo: string) {
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/roles');
  const admin = createAdminClient();

  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'rolePermissions');
  } catch {
    redirect(returnToWithError(returnTo, 'upgrade'));
  }

  const permissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(permissions, 'team.manage_roles');
  } catch (error) {
    const message = permissionDeniedMessage(error);
    redirect(returnToWithError(returnTo, message ? 'forbidden' : 'forbidden'));
  }

  return { membership, admin };
}

export async function createTenantRoleAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/roles').trim() || '/settings/roles';
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const baseRoleRaw = String(formData.get('base_role') ?? '').trim();
  const baseRole = BASE_ROLES.has(baseRoleRaw as TenantRole) ? (baseRoleRaw as TenantRole) : null;
  const permissionKeys = parsePermissionKeys(formData);

  if (!tenantSlug || !name || !baseRole) {
    redirect(returnToWithError(returnTo, 'invalid'));
  }

  const { membership, admin } = await assertCanManageRoles(tenantSlug, returnTo);

  let slug = slugifyRoleName(name);
  if (!slug || SYSTEM_SLUGS.has(slug)) {
    slug = `${slug || 'role'}-${Date.now().toString(36)}`;
  }

  const { data: existingSlug } = await admin
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', membership.tenantId)
    .eq('slug', slug)
    .maybeSingle();
  if (existingSlug) {
    redirect(returnToWithError(returnTo, 'duplicate'));
  }

  const { data: role, error: insertError } = await admin
    .from('tenant_roles')
    .insert({
      tenant_id: membership.tenantId,
      name,
      slug,
      description: description || null,
      base_role: baseRole,
      is_system: false,
    })
    .select('id')
    .single();

  if (insertError || !role) {
    redirect(returnToWithError(returnTo, 'create'));
  }

  const keys = permissionKeys.length > 0 ? permissionKeys : [...PERMISSION_KEYS];
  if (keys.length > 0) {
    await admin.from('tenant_role_permissions').insert(
      keys.map((permission_key) => ({
        role_id: role.id,
        permission_key,
      })),
    );
  }

  revalidatePath('/settings/roles');
  redirect(`${returnTo}?saved=1`);
}

export async function updateTenantRoleAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/roles').trim() || '/settings/roles';
  const roleId = String(formData.get('role_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const baseRoleRaw = String(formData.get('base_role') ?? '').trim();
  const permissionKeys = parsePermissionKeys(formData);

  if (!tenantSlug || !roleId || !name) {
    redirect(returnToWithError(returnTo, 'invalid'));
  }

  const { membership, admin } = await assertCanManageRoles(tenantSlug, returnTo);

  const { data: existing, error: loadError } = await admin
    .from('tenant_roles')
    .select('id, is_system, base_role')
    .eq('id', roleId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (loadError || !existing) {
    redirect(returnToWithError(returnTo, 'missing'));
  }

  const updatePayload: {
    name: string;
    description: string | null;
    base_role?: TenantRole;
  } = {
    name,
    description: description || null,
  };

  if (!existing.is_system) {
    const baseRole = BASE_ROLES.has(baseRoleRaw as TenantRole) ? (baseRoleRaw as TenantRole) : null;
    if (!baseRole) {
      redirect(returnToWithError(returnTo, 'invalid'));
    }
    updatePayload.base_role = baseRole;
  }

  const { error: updateError } = await admin
    .from('tenant_roles')
    .update(updatePayload)
    .eq('id', roleId)
    .eq('tenant_id', membership.tenantId);

  if (updateError) {
    redirect(returnToWithError(returnTo, 'update'));
  }

  const keys =
    permissionKeys.length > 0 ? permissionKeys : existing.is_system ? [] : [...PERMISSION_KEYS];

  if (keys.length > 0) {
    const recoveryError = await assertTeamRecoveryAccessRemains(
      admin,
      membership.tenantId,
      roleId,
      keys,
    );
    if (recoveryError) {
      redirect(returnToWithError(returnTo, 'recovery'));
    }
  }

  await admin.from('tenant_role_permissions').delete().eq('role_id', roleId);

  if (keys.length > 0) {
    await admin.from('tenant_role_permissions').insert(
      keys.map((permission_key) => ({
        role_id: roleId,
        permission_key,
      })),
    );
  } else if (existing.is_system) {
    redirect(returnToWithError(returnTo, 'permissions'));
  }

  revalidatePath('/settings/roles');
  redirect(`${returnTo}?saved=1`);
}

export async function deleteTenantRoleAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const returnTo =
    String(formData.get('return_to') ?? '/settings/roles').trim() || '/settings/roles';
  const roleId = String(formData.get('role_id') ?? '').trim();

  if (!tenantSlug || !roleId) {
    redirect(returnToWithError(returnTo, 'invalid'));
  }

  const { membership, admin } = await assertCanManageRoles(tenantSlug, returnTo);

  const { data: existing, error: loadError } = await admin
    .from('tenant_roles')
    .select('id, is_system')
    .eq('id', roleId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (loadError || !existing) {
    redirect(returnToWithError(returnTo, 'missing'));
  }
  if (existing.is_system) {
    redirect(returnToWithError(returnTo, 'protected'));
  }

  const { count, error: countError } = await admin
    .from('tenant_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId)
    .eq('role_id', roleId);

  if (countError) {
    redirect(returnToWithError(returnTo, 'delete'));
  }
  if ((count ?? 0) > 0) {
    redirect(returnToWithError(returnTo, 'in_use'));
  }

  const { error: deleteError } = await admin
    .from('tenant_roles')
    .delete()
    .eq('id', roleId)
    .eq('tenant_id', membership.tenantId);

  if (deleteError) {
    redirect(returnToWithError(returnTo, 'delete'));
  }

  revalidatePath('/settings/roles');
  redirect(`${returnTo}?deleted=1`);
}
