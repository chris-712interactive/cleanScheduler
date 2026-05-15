'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { isResendConfigured, sendEmployeeInviteEmail } from '@/lib/email/resend';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  allowedInviteRolesForActor,
  canManageTeamInvitesAndRoles,
  parseTenantRoleForInvite,
} from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function roleLabel(r: TenantRole): string {
  if (r === 'admin') return 'Admin';
  if (r === 'viewer') return 'Viewer';
  if (r === 'employee') return 'Employee';
  if (r === 'owner') return 'Owner';
  return r;
}

export interface EmployeeInviteFormState {
  error?: string;
  success?: string;
}

export async function sendEmployeeInviteAction(
  _prev: EmployeeInviteFormState,
  formData: FormData,
): Promise<EmployeeInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const emailRaw = String(formData.get('email') ?? '').trim().toLowerCase();
  const roleRaw = String(formData.get('invited_role') ?? '').trim();

  if (!slug || !emailRaw) {
    return { error: 'Email and workspace are required.' };
  }
  if (!EMAIL_RE.test(emailRaw)) {
    return { error: 'Enter a valid email address.' };
  }

  const invitedRole = parseTenantRoleForInvite(roleRaw);
  if (!invitedRole) {
    return { error: 'Pick a permission level for this invite.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees/new');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only workspace owners and admins can invite team members.' };
  }
  if (!allowedInviteRolesForActor(membership.role).includes(invitedRole)) {
    return { error: 'You cannot assign that role.' };
  }

  const auth = await getAuthContext();
  if (!auth) {
    return { error: 'You must be signed in to send an invite.' };
  }

  if (!isResendConfigured()) {
    return {
      error:
        'Configure RESEND_API_KEY and RESEND_FROM_EMAIL on the server to email employee invites.',
    };
  }

  const admin = createAdminClient();

  const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return { error: listErr.message };
  }
  const existing = existingUsers.users.find((u) => (u.email ?? '').trim().toLowerCase() === emailRaw);
  if (existing) {
    const { data: already } = await admin
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', membership.tenantId)
      .eq('user_id', existing.id)
      .maybeSingle();
    if (already) {
      return { error: 'That person is already a member of this workspace.' };
    }
    const appRole = (existing.app_metadata as { app_role?: string })?.app_role;
    if (appRole === 'customer') {
      return {
        error:
          'That email already uses the customer portal. Use a work email or a different address for team access.',
      };
    }
    const { data: otherMembership } = await admin
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', existing.id)
      .neq('tenant_id', membership.tenantId)
      .limit(1)
      .maybeSingle();
    if (otherMembership) {
      return {
        error:
          'That login is already linked to another workspace. Ask them to open the invite link and use “Link existing account”, or use a different email.',
      };
    }
  }

  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('id', membership.tenantId)
    .maybeSingle();
  if (tErr || !tenant) {
    return { error: 'Could not load workspace.' };
  }

  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 7);

  await admin
    .from('employee_invites')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('email_normalized', emailRaw)
    .is('used_at', null);

  const { data: invite, error: invErr } = await admin
    .from('employee_invites')
    .insert({
      tenant_id: membership.tenantId,
      email_normalized: emailRaw,
      invited_role: invitedRole,
      invited_by_user_id: auth.user.id,
      expires_at: expires.toISOString(),
    })
    .select('token')
    .single();

  if (invErr || !invite?.token) {
    return { error: invErr?.message ?? 'Could not create invite.' };
  }

  const tenantName = String(tenant.name ?? tenant.slug).trim() || slug;
  const acceptUrl = `${getPublicOrigin(null)}/complete-employee-invite?token=${invite.token}`;
  const workspaceUrl = getPublicOrigin(tenant.slug);

  const sent = await sendEmployeeInviteEmail({
    to: emailRaw,
    tenantName,
    roleLabel: roleLabel(invitedRole),
    acceptUrl,
    workspaceUrl,
  });
  if (!sent.ok) {
    await admin.from('employee_invites').delete().eq('token', invite.token);
    return { error: sent.error };
  }

  revalidatePath('/employees');
  revalidatePath('/employees/new');
  return { success: `Invite sent to ${emailRaw}.` };
}
