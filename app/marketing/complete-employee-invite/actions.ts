'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { shouldAutoConfirmEmail } from '@/lib/auth/emailConfirmMode';
import { getAuthContext } from '@/lib/auth/session';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { TenantRole } from '@/lib/auth/types';

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CompleteEmployeeInviteState {
  error?: string;
  success?: string;
  duplicateAccount?: boolean;
}

function appRoleForTenantRole(tr: TenantRole): 'admin' | 'employee' {
  return tr === 'admin' ? 'admin' : 'employee';
}

async function loadActiveEmployeeInvite(admin: SupabaseClient<Database>, token: string) {
  const { data: invite, error } = await admin
    .from('employee_invites')
    .select(
      `
      token,
      tenant_id,
      email_normalized,
      invited_role,
      expires_at,
      used_at,
      tenants:tenants!inner ( name, slug )
    `,
    )
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    return { ok: false as const, error: 'This invite link is invalid or has expired.' };
  }
  if (invite.used_at) {
    return { ok: false as const, error: 'This invite has already been used.' };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return {
      ok: false as const,
      error: 'This invite has expired. Ask your manager to send a new one.',
    };
  }
  return { ok: true as const, invite };
}

export async function linkExistingEmployeeInviteAction(
  _prev: CompleteEmployeeInviteState,
  formData: FormData,
): Promise<CompleteEmployeeInviteState> {
  const auth = await getAuthContext();
  if (!auth?.user.email) {
    return { error: 'Sign in on this page first (same browser), then tap Link my account.' };
  }

  const token = String(formData.get('token') ?? '')
    .trim()
    .toLowerCase();
  if (!TOKEN_RE.test(token)) {
    return { error: 'Invalid invite link.' };
  }

  const admin = createAdminClient();
  const loaded = await loadActiveEmployeeInvite(admin, token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const { invite } = loaded;
  const email = auth.user.email.trim().toLowerCase();
  if (email !== invite.email_normalized) {
    return {
      error: `You are signed in as ${email}, but this invite was sent to ${invite.email_normalized}.`,
    };
  }

  const appRole = auth.claims.appRole;
  if (appRole === 'customer') {
    return {
      error:
        'This customer login cannot join a workspace team. Use a work email or ask for a new invite.',
    };
  }
  if (appRole === 'super_admin') {
    return {
      error:
        'Platform admin accounts cannot join a tenant team through this link. Use a workspace-specific login.',
    };
  }

  const tenantsEmbed = invite.tenants as { slug: string; name: string } | { slug: string; name: string }[] | null;
  const tenantInfo = Array.isArray(tenantsEmbed) ? tenantsEmbed[0] : tenantsEmbed;
  const tenantSlugEarly = tenantInfo?.slug ?? '';

  const { data: existingRow } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', invite.tenant_id)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (existingRow) {
    await admin.from('employee_invites').update({ used_at: new Date().toISOString() }).eq('token', token);
    redirect(`${getPublicOrigin(tenantSlugEarly)}/?invite=already_member`);
  }

  const { data: other } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('user_id', auth.user.id)
    .neq('tenant_id', invite.tenant_id)
    .limit(1)
    .maybeSingle();
  if (other) {
    return {
      error: 'Your account is already linked to another workspace. Use a different email for this team.',
    };
  }

  const invitedRole = invite.invited_role as TenantRole;
  const nextAppRole = appRoleForTenantRole(invitedRole);

  const { error: insErr } = await admin.from('tenant_memberships').insert({
    tenant_id: invite.tenant_id,
    user_id: auth.user.id,
    role: invitedRole,
    is_active: true,
  });
  if (insErr) {
    return { error: insErr.message };
  }

  const displayName =
    (typeof auth.user.user_metadata?.display_name === 'string' &&
      auth.user.user_metadata.display_name.trim()) ||
    email.split('@')[0] ||
    'Team member';

  const { error: profErr } = await admin.from('user_profiles').upsert(
    {
      user_id: auth.user.id,
      app_role: nextAppRole,
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );
  if (profErr) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', invite.tenant_id).eq('user_id', auth.user.id);
    return { error: profErr.message };
  }

  const meta = { ...(auth.user.app_metadata ?? {}) };
  meta.app_role = nextAppRole;
  meta.tenant_role = invitedRole;
  meta.current_tenant_id = invite.tenant_id;

  const { error: metaErr } = await admin.auth.admin.updateUserById(auth.user.id, {
    app_metadata: meta,
  });
  if (metaErr) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', invite.tenant_id).eq('user_id', auth.user.id);
    return { error: metaErr.message };
  }

  await admin.from('employee_invites').update({ used_at: new Date().toISOString() }).eq('token', token);

  redirect(`${getPublicOrigin(tenantSlugEarly)}/?welcome=1`);
}

export async function acceptEmployeeInviteAction(
  _prev: CompleteEmployeeInviteState,
  formData: FormData,
): Promise<CompleteEmployeeInviteState> {
  const token = String(formData.get('token') ?? '')
    .trim()
    .toLowerCase();
  if (!TOKEN_RE.test(token)) {
    return { error: 'Invalid invite link.' };
  }

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  if (!shouldAutoConfirmEmail()) {
    return {
      error:
        'Automatic email confirmation is off for this environment. Set ONBOARDING_EMAIL_CONFIRM_MODE to auto or disabled for dev, or use “Link my account”.',
    };
  }

  const admin = createAdminClient();
  const loaded = await loadActiveEmployeeInvite(admin, token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const { invite } = loaded;
  const email = invite.email_normalized;
  const invitedRole = invite.invited_role as TenantRole;
  const nextAppRole = appRoleForTenantRole(invitedRole);
  const displayName = email.split('@')[0] || 'Team member';

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      app_role: nextAppRole,
      tenant_role: invitedRole,
      current_tenant_id: invite.tenant_id,
    },
    user_metadata: {
      display_name: displayName,
    },
  });

  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? 'Could not create account.';
    if (/already|registered|exists/i.test(msg)) {
      return {
        duplicateAccount: true,
        error: 'An account already exists for this email. Sign in below, then link this invite.',
      };
    }
    return { error: msg };
  }

  const userId = created.data.user.id;

  const { error: memErr } = await admin.from('tenant_memberships').insert({
    tenant_id: invite.tenant_id,
    user_id: userId,
    role: invitedRole,
    is_active: true,
  });
  if (memErr) {
    await admin.auth.admin.deleteUser(userId);
    return { error: memErr.message };
  }

  const { error: profErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      app_role: nextAppRole,
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );
  if (profErr) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', invite.tenant_id).eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return { error: profErr.message };
  }

  const session = await createClient();
  const { error: signErr } = await session.auth.signInWithPassword({ email, password });
  if (signErr) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', invite.tenant_id).eq('user_id', userId);
    await admin.from('user_profiles').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return {
      error: `Account was created but sign-in failed (${signErr.message}). Try signing in at your workspace URL.`,
    };
  }

  await admin.from('employee_invites').update({ used_at: new Date().toISOString() }).eq('token', token);

  const tenantsRaw = invite.tenants as { slug: string; name: string } | { slug: string; name: string }[] | null;
  const tenantRow = Array.isArray(tenantsRaw) ? tenantsRaw[0] : tenantsRaw;
  const tenantSlug = tenantRow?.slug ?? '';
  redirect(`${getPublicOrigin(tenantSlug)}/?welcome=1`);
}
