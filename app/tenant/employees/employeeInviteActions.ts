'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { emailBrandForTenant } from '@/lib/email/emailBrand';
import { issueEmployeeInvite } from '@/lib/tenant/issueEmployeeInvite';
import { isResendConfigured, sendEmployeeInviteEmail } from '@/lib/email/resend';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  allowedInviteRolesForActor,
  parseTenantRoleForInvite,
} from '@/lib/tenant/employeePermissions';
import {
  assertPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import type { TenantRole } from '@/lib/auth/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function roleLabel(r: TenantRole): string {
  if (r === 'admin') return 'Admin';
  if (r === 'viewer') return 'Viewer';
  if (r === 'employee') return 'Field employee';
  if (r === 'owner') return 'Owner';
  return r;
}

export interface EmployeeInviteFormState {
  error?: string;
  success?: string;
  limitExceeded?: boolean;
}

export async function sendEmployeeInviteAction(
  _prev: EmployeeInviteFormState,
  formData: FormData,
): Promise<EmployeeInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const emailRaw = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
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
  const admin = createAdminClient();
  const actorPermissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(actorPermissions, 'team.invite');
  } catch (error) {
    const message = permissionDeniedMessage(error);
    return { error: message ?? 'You cannot invite team members.' };
  }
  if (!allowedInviteRolesForActor(membership.role).includes(invitedRole)) {
    return { error: 'You cannot assign that role.' };
  }

  const auth = await getAuthContext();
  if (!auth) {
    return { error: 'You must be signed in to send an invite.' };
  }

  const plan = await resolveTenantPlanTier(admin, membership.tenantId);
  const issued = await issueEmployeeInvite({
    admin,
    tenantId: membership.tenantId,
    email: emailRaw,
    invitedRole,
    invitedByUserId: auth.user.id,
    actorRole: membership.role,
    plan,
  });
  if (!issued.ok) {
    return { error: issued.error, limitExceeded: issued.limitExceeded };
  }

  revalidatePath('/employees');
  revalidatePath('/employees/new');
  return { success: `Invite sent to ${emailRaw}.` };
}

async function sendInviteEmailForToken(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  token: string,
): Promise<EmployeeInviteFormState> {
  const { data: invite, error: invErr } = await admin
    .from('employee_invites')
    .select('email_normalized, invited_role, tenant_id, used_at, expires_at')
    .eq('token', token)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invErr || !invite) {
    return { error: 'Invite not found.' };
  }
  if (invite.used_at) {
    return { error: 'That invite was already accepted.' };
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'That invite has expired. Send a new invite instead.' };
  }

  if (!isResendConfigured()) {
    return {
      error:
        'Configure RESEND_API_KEY and RESEND_FROM_EMAIL on the server to email employee invites.',
    };
  }

  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select(
      'name, slug, brand_color, logo_url, business_phone, business_email, address_line1, city, state, postal_code',
    )
    .eq('id', tenantId)
    .maybeSingle();
  if (tErr || !tenant) {
    return { error: 'Could not load workspace.' };
  }

  const tenantName = String(tenant.name ?? tenant.slug).trim() || tenant.slug;
  const acceptUrl = `${getPublicOrigin(null)}/complete-employee-invite?token=${token}`;
  const workspaceUrl = getPublicOrigin(tenant.slug);
  const brand = await emailBrandForTenant(admin, tenantId, tenant);

  const sent = await sendEmployeeInviteEmail({
    to: invite.email_normalized,
    tenantName,
    roleLabel: roleLabel(invite.invited_role),
    acceptUrl,
    workspaceUrl,
    brand,
  });
  if (!sent.ok) {
    return { error: sent.error };
  }

  return { success: `Invite resent to ${invite.email_normalized}.` };
}

export async function resendEmployeeInviteAction(
  _prev: EmployeeInviteFormState,
  formData: FormData,
): Promise<EmployeeInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  if (!slug || !token) {
    return { error: 'Missing invite details.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees');
  const admin = createAdminClient();
  const actorPermissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(actorPermissions, 'team.invite');
  } catch (error) {
    const message = permissionDeniedMessage(error);
    return { error: message ?? 'You cannot manage invites.' };
  }

  const result = await sendInviteEmailForToken(admin, membership.tenantId, token);
  if (result.success) {
    revalidatePath('/employees');
  }
  return result;
}

export async function revokeEmployeeInviteAction(
  _prev: EmployeeInviteFormState,
  formData: FormData,
): Promise<EmployeeInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  if (!slug || !token) {
    return { error: 'Missing invite details.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/employees');
  const admin = createAdminClient();
  const actorPermissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(actorPermissions, 'team.invite');
  } catch (error) {
    const message = permissionDeniedMessage(error);
    return { error: message ?? 'You cannot manage invites.' };
  }

  const { error } = await admin
    .from('employee_invites')
    .delete()
    .eq('token', token)
    .eq('tenant_id', membership.tenantId)
    .is('used_at', null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/employees');
  return { success: 'Invite canceled.' };
}
