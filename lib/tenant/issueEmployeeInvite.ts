import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import { isLimitExceededError } from '@/lib/billing/checkLimit';
import type { EntitlementPlanKey } from '@/lib/billing/entitlements';
import {
  assertFeatureEnabledForPlan,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import {
  assertCanAssignTeamSeat,
  countTeamSeatUsage,
  teamSeatGateErrorMessage,
} from '@/lib/billing/teamSeats';
import { emailBrandForTenant } from '@/lib/email/emailBrand';
import { isResendConfigured, sendEmployeeInviteEmail } from '@/lib/email/resend';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Database } from '@/lib/supabase/database.types';
import { allowedInviteRolesForActor } from '@/lib/tenant/employeePermissions';

type Admin = SupabaseClient<Database>;

function roleLabel(role: TenantRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'viewer') return 'Viewer';
  if (role === 'employee') return 'Field employee';
  if (role === 'owner') return 'Owner';
  return role;
}

export async function issueEmployeeInvite(params: {
  admin: Admin;
  tenantId: string;
  email: string;
  invitedRole: TenantRole;
  invitedByUserId: string;
  actorRole: TenantRole;
  plan: EntitlementPlanKey;
}): Promise<{ ok: true; token: string } | { ok: false; error: string; limitExceeded?: boolean }> {
  const emailRaw = params.email.trim().toLowerCase();
  if (!allowedInviteRolesForActor(params.actorRole).includes(params.invitedRole)) {
    return { ok: false, error: 'You cannot assign that role.' };
  }

  if (params.invitedRole === 'admin' || params.invitedRole === 'viewer') {
    try {
      assertFeatureEnabledForPlan(params.plan, 'rolePermissions');
    } catch (error) {
      const message = featureGateErrorMessage(error);
      if (message) return { ok: false, error: message };
      throw error;
    }
  }

  const { data: existingUsers, error: listErr } = await params.admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) return { ok: false, error: listErr.message };

  if (!isResendConfigured()) {
    return {
      ok: false,
      error:
        'Configure RESEND_API_KEY and RESEND_FROM_EMAIL on the server to email employee invites.',
    };
  }

  const existing = existingUsers.users.find(
    (user) => (user.email ?? '').trim().toLowerCase() === emailRaw,
  );
  if (existing) {
    const { data: already } = await params.admin
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('user_id', existing.id)
      .maybeSingle();
    if (already) {
      return { ok: false, error: 'That person is already a member of this workspace.' };
    }
    const appRole = (existing.app_metadata as { app_role?: string })?.app_role;
    if (appRole === 'customer') {
      return {
        ok: false,
        error:
          'That email already uses the customer portal. Use a work email or a different address for team access.',
      };
    }
    const { data: otherMembership } = await params.admin
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', existing.id)
      .neq('tenant_id', params.tenantId)
      .limit(1)
      .maybeSingle();
    if (otherMembership) {
      return {
        ok: false,
        error:
          'That login is already linked to another workspace. Ask them to open the invite link and use “Link existing account”, or use a different email.',
      };
    }
  }

  const { data: tenant, error: tenantError } = await params.admin
    .from('tenants')
    .select(
      'name, slug, brand_color, logo_url, business_phone, business_email, address_line1, city, state, postal_code',
    )
    .eq('id', params.tenantId)
    .maybeSingle();
  if (tenantError || !tenant) return { ok: false, error: 'Could not load workspace.' };

  const { data: existingPendingInvite } = await params.admin
    .from('employee_invites')
    .select('invited_role')
    .eq('tenant_id', params.tenantId)
    .eq('email_normalized', emailRaw)
    .is('used_at', null)
    .maybeSingle();

  try {
    const usage = await countTeamSeatUsage(params.admin, params.tenantId);
    assertCanAssignTeamSeat({
      plan: params.plan,
      role: params.invitedRole,
      usage,
      replaceRole: existingPendingInvite
        ? (existingPendingInvite.invited_role as TenantRole)
        : undefined,
    });
  } catch (error) {
    const message = teamSeatGateErrorMessage(error);
    if (message) return { ok: false, error: message, limitExceeded: isLimitExceededError(error) };
    throw error;
  }

  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 7);

  await params.admin
    .from('employee_invites')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('email_normalized', emailRaw)
    .is('used_at', null);

  const { data: invite, error: inviteError } = await params.admin
    .from('employee_invites')
    .insert({
      tenant_id: params.tenantId,
      email_normalized: emailRaw,
      invited_role: params.invitedRole,
      invited_by_user_id: params.invitedByUserId,
      expires_at: expires.toISOString(),
    })
    .select('token')
    .single();

  if (inviteError || !invite?.token) {
    return { ok: false, error: inviteError?.message ?? 'Could not create invite.' };
  }

  const tenantName = String(tenant.name ?? tenant.slug).trim() || tenant.slug;
  const acceptUrl = `${getPublicOrigin(null)}/complete-employee-invite?token=${invite.token}`;
  const workspaceUrl = getPublicOrigin(tenant.slug);
  const brand = await emailBrandForTenant(params.admin, params.tenantId, tenant);
  const sent = await sendEmployeeInviteEmail({
    to: emailRaw,
    tenantName,
    roleLabel: roleLabel(params.invitedRole),
    acceptUrl,
    workspaceUrl,
    brand,
  });
  if (!sent.ok) {
    await params.admin.from('employee_invites').delete().eq('token', invite.token);
    return { ok: false, error: sent.error };
  }

  return { ok: true, token: invite.token };
}
