'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { canChangeMemberRole, canToggleMemberActive } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';

type MemberRoleUpdate = Exclude<TenantRole, 'owner'>;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;

function extForMime(m: string): string | null {
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return null;
}

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

  revalidatePath('/employees');
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

  revalidatePath('/employees');
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
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be 2MB or smaller.' };
  }
  const mime = file.type;
  if (!ALLOWED_MIME.has(mime)) {
    return { error: 'Use JPEG, PNG, WebP, or GIF.' };
  }
  const ext = extForMime(mime);
  if (!ext) return { error: 'Unsupported image type.' };

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${membership.tenantId}/${targetUserId}.${ext}`;

  const { error: upStorage } = await admin.storage.from('employee_avatars').upload(path, buf, {
    contentType: mime,
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

  revalidatePath('/employees');
  revalidatePath('/settings');
  return { success: 'Photo updated.' };
}
