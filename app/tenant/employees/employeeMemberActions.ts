'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import {
  canChangeMemberRole,
  canEditTeamMember,
  canToggleMemberActive,
} from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';
import {
  AVATAR_ALLOWED_INPUT_MIME,
  AVATAR_MAX_UPLOAD_BYTES,
  prepareEmployeeAvatar,
} from '@/lib/images/employeeAvatar';

type MemberRoleUpdate = Exclude<TenantRole, 'owner'>;

export interface MemberActionState {
  error?: string;
  success?: string;
}

async function assertTargetInTenant(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  targetUserId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  return Boolean(data);
}

function revalidateMemberPaths(targetUserId: string) {
  revalidatePath('/employees');
  revalidatePath(`/employees/${targetUserId}`);
  revalidatePath('/', 'layout');
}

export async function updateTeamMemberDisplayNameAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const name = String(formData.get('display_name') ?? '').trim();
  if (!slug || !targetUserId) return { error: 'Missing fields.' };
  if (!name || name.length > 120) {
    return { error: 'Enter a display name (max 120 characters).' };
  }

  const membership = await requireTenantPortalAccess(slug, `/employees/${targetUserId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { data: targetRow, error: tErr } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (tErr || !targetRow) return { error: 'Member not found.' };

  if (
    !canEditTeamMember({
      actor: membership.role,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole: targetRow.role as TenantRole,
    })
  ) {
    return { error: 'You cannot edit this member.' };
  }

  const { error } = await admin
    .from('user_profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (error) return { error: error.message };

  await admin.auth.admin.updateUserById(targetUserId, {
    user_metadata: { display_name: name },
  });

  revalidateMemberPaths(targetUserId);
  return { success: 'Display name saved.' };
}

export async function updateTenantMemberRoleAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const raw = String(formData.get('next_role') ?? '').trim();
  const nextRole: MemberRoleUpdate | null =
    raw === 'admin' || raw === 'employee' || raw === 'viewer' ? raw : null;
  if (!slug || !targetUserId) {
    return { error: 'Missing fields.' };
  }
  if (!nextRole) {
    return { error: 'Invalid role.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { data: targetRow, error: tErr } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (tErr || !targetRow) {
    return { error: 'Member not found.' };
  }

  const targetCurrentRole = targetRow.role as TenantRole;
  if (
    !canChangeMemberRole({
      actor: membership.role,
      actorUserId: auth.user.id,
      targetUserId,
      targetCurrentRole,
      nextRole,
    })
  ) {
    return { error: 'You cannot assign that role change.' };
  }

  if (targetCurrentRole === 'owner') {
    const { count, error: cErr } = await admin
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .eq('role', 'owner')
      .eq('is_active', true);
    if (cErr) return { error: cErr.message };
    if ((count ?? 0) < 2) {
      return { error: 'There must be at least one active owner. Add another owner before changing this role.' };
    }
  }

  const { error: upErr } = await admin
    .from('tenant_memberships')
    .update({ role: nextRole, updated_at: new Date().toISOString() })
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId);
  if (upErr) return { error: upErr.message };

  const nextAppRole = nextRole === 'admin' ? 'admin' : 'employee';
  const { error: metaErr } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: {
      tenant_role: nextRole,
      app_role: nextAppRole,
      current_tenant_id: membership.tenantId,
    },
  });
  if (metaErr) return { error: metaErr.message };

  const { error: profErr } = await admin
    .from('user_profiles')
    .update({ app_role: nextAppRole, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (profErr) return { error: profErr.message };

  revalidateMemberPaths(targetUserId);
  return { success: 'Role updated.' };
}

export async function setTenantMemberActiveAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const activeRaw = String(formData.get('is_active') ?? '').trim();
  const isActive = activeRaw === 'true';

  if (!slug || !targetUserId) {
    return { error: 'Missing fields.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { data: targetRow, error: tErr } = await admin
    .from('tenant_memberships')
    .select('role, is_active')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (tErr || !targetRow) {
    return { error: 'Member not found.' };
  }

  if (
    !canToggleMemberActive({
      actor: membership.role,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole: targetRow.role as TenantRole,
    })
  ) {
    return { error: 'You cannot change activation for this member.' };
  }

  if (!isActive && (targetRow.role as TenantRole) === 'owner') {
    const { count, error: cErr } = await admin
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .eq('role', 'owner')
      .eq('is_active', true);
    if (cErr) return { error: cErr.message };
    if ((count ?? 0) < 2) {
      return { error: 'Cannot deactivate the only owner.' };
    }
  }

  const { error: upErr } = await admin
    .from('tenant_memberships')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId);
  if (upErr) return { error: upErr.message };

  revalidateMemberPaths(targetUserId);
  return { success: isActive ? 'Member reactivated.' : 'Member deactivated.' };
}

export async function uploadTeamMemberAvatarAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  if (!slug || !targetUserId) {
    return { error: 'Missing fields.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees');
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { error: 'Only owners and admins can update another member’s photo.' };
  }

  const admin = createAdminClient();
  if (!(await assertTargetInTenant(admin, membership.tenantId, targetUserId))) {
    return { error: 'Member not in this workspace.' };
  }

  const file = formData.get('avatar') as File | null;
  if (!file || typeof file === 'string' || file.size < 1) {
    return { error: 'Choose an image file.' };
  }
  if (file.size > AVATAR_MAX_UPLOAD_BYTES) {
    return { error: 'Image is too large to upload (max 10MB). Try a smaller file.' };
  }
  if (!AVATAR_ALLOWED_INPUT_MIME.has(file.type)) {
    return { error: 'Use JPEG, PNG, WebP, or GIF.' };
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const prepared = await prepareEmployeeAvatar(raw);
  if (!prepared.ok) {
    return { error: prepared.error };
  }

  const path = `${membership.tenantId}/${targetUserId}.${prepared.fileExtension}`;

  const { error: upStorage } = await admin.storage.from('employee_avatars').upload(path, prepared.buffer, {
    contentType: prepared.contentType,
    upsert: true,
  });
  if (upStorage) {
    return { error: upStorage.message };
  }

  const { data: pub } = admin.storage.from('employee_avatars').getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: pErr } = await admin
    .from('user_profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (pErr) return { error: pErr.message };

  revalidateMemberPaths(targetUserId);
  revalidatePath('/settings');
  return { success: 'Photo updated.' };
}
