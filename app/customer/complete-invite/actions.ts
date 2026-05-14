'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { shouldAutoConfirmEmail } from '@/lib/auth/emailConfirmMode';
import { getAuthContext } from '@/lib/auth/session';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CompleteInviteState {
  error?: string;
  success?: string;
  /** When set, UI can prompt for sign-in + link instead of password signup. */
  duplicateAccount?: boolean;
}

async function loadActiveInvite(admin: SupabaseClient<Database>, token: string) {
  const { data: invite, error } = await admin
    .from('customer_portal_invites')
    .select(
      `
      token,
      tenant_id,
      customer_id,
      customer_identity_id,
      email_normalized,
      expires_at,
      used_at,
      tenants:tenants!inner ( name )
    `,
    )
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) return { ok: false as const, error: 'This invite link is invalid or has expired.' };

  if (invite.used_at) {
    return { ok: false as const, error: 'This invite has already been used.' };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: 'This invite has expired. Ask your provider to send a new one.' };
  }

  return { ok: true as const, invite };
}

export async function linkExistingCustomerInviteAction(
  _prev: CompleteInviteState,
  formData: FormData,
): Promise<CompleteInviteState> {
  const auth = await getAuthContext();
  if (!auth?.user.email) {
    return { error: 'Sign in on this page first (same browser), then tap Link my account.' };
  }

  const token = String(formData.get('token') ?? '').trim().toLowerCase();
  if (!TOKEN_RE.test(token)) {
    return { error: 'Invalid invite link.' };
  }

  const admin = createAdminClient();
  const loaded = await loadActiveInvite(admin, token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const { invite } = loaded;
  const email = auth.user.email.trim().toLowerCase();
  if (email !== invite.email_normalized) {
    return {
      error: `You are signed in as ${email}, but this invite was sent to ${invite.email_normalized}. Sign out and use the correct account.`,
    };
  }

  const { data: identity, error: idErr } = await admin
    .from('customer_identities')
    .select('id, auth_user_id')
    .eq('id', invite.customer_identity_id)
    .maybeSingle();

  if (idErr || !identity) {
    return { error: 'Could not load customer identity.' };
  }

  if (identity.auth_user_id) {
    if (identity.auth_user_id === auth.user.id) {
      await admin.from('customer_portal_invites').update({ used_at: new Date().toISOString() }).eq('token', token);
      redirect('/');
    }
    return { error: 'This customer record is already linked to a different login.' };
  }

  const { error: upId } = await admin
    .from('customer_identities')
    .update({ auth_user_id: auth.user.id })
    .eq('id', identity.id)
    .is('auth_user_id', null);

  if (upId) {
    return { error: upId.message };
  }

  const displayName =
    (typeof auth.user.user_metadata?.display_name === 'string' && auth.user.user_metadata.display_name) ||
    auth.user.email.split('@')[0] ||
    'Customer';

  const { error: profErr } = await admin.from('user_profiles').upsert(
    {
      user_id: auth.user.id,
      app_role: 'customer',
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );

  if (profErr) {
    await admin.from('customer_identities').update({ auth_user_id: null }).eq('id', identity.id);
    return { error: profErr.message };
  }

  const meta = { ...(auth.user.app_metadata ?? {}) };
  meta.app_role = 'customer';

  const { error: metaErr } = await admin.auth.admin.updateUserById(auth.user.id, {
    app_metadata: meta,
  });

  if (metaErr) {
    await admin.from('customer_identities').update({ auth_user_id: null }).eq('id', identity.id);
    return { error: metaErr.message };
  }

  await admin.from('customer_portal_invites').update({ used_at: new Date().toISOString() }).eq('token', token);

  redirect('/');
}

export async function acceptCustomerPortalInviteAction(
  _prev: CompleteInviteState,
  formData: FormData,
): Promise<CompleteInviteState> {
  const token = String(formData.get('token') ?? '').trim().toLowerCase();
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
        'Automatic email confirmation is off for this environment. Set ONBOARDING_EMAIL_CONFIRM_MODE to auto or disabled for dev, or use “Link my account” if you already signed up with this email.',
    };
  }

  const admin = createAdminClient();
  const loaded = await loadActiveInvite(admin, token);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const { invite } = loaded;

  const { data: identity, error: idErr } = await admin
    .from('customer_identities')
    .select('id, email, first_name, last_name, full_name, auth_user_id')
    .eq('id', invite.customer_identity_id)
    .maybeSingle();

  if (idErr || !identity?.email) {
    return { error: 'Could not load customer identity for this invite.' };
  }

  if (identity.auth_user_id) {
    return { error: 'This invite is no longer valid (account already linked).' };
  }

  const email = identity.email.trim().toLowerCase();
  if (email !== invite.email_normalized) {
    return { error: 'Invite email does not match customer record. Contact your provider.' };
  }

  const formatted = formatCustomerDisplayName(identity);
  const displayName = formatted !== 'Unnamed' ? formatted : email.split('@')[0] || 'Customer';

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      app_role: 'customer',
    },
    user_metadata: {
      display_name: displayName,
    },
  });

  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? 'Could not create account.';
    if (/already|registered|exists/i.test(msg)) {
      return { duplicateAccount: true, error: 'An account already exists for this email. Sign in below, then link this invite.' };
    }
    return { error: msg };
  }

  const userId = created.data.user.id;

  const { error: linkErr } = await admin
    .from('customer_identities')
    .update({ auth_user_id: userId })
    .eq('id', identity.id)
    .is('auth_user_id', null);

  if (linkErr) {
    await admin.auth.admin.deleteUser(userId);
    return { error: linkErr.message };
  }

  const { error: profErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      app_role: 'customer',
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );

  if (profErr) {
    await admin.from('customer_identities').update({ auth_user_id: null }).eq('id', identity.id);
    await admin.auth.admin.deleteUser(userId);
    return { error: profErr.message };
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      app_role: 'customer',
    },
  });

  const session = await createClient();
  const { error: signErr } = await session.auth.signInWithPassword({ email, password });
  if (signErr) {
    await admin.from('customer_identities').update({ auth_user_id: null }).eq('id', identity.id);
    await admin.from('user_profiles').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return {
      error: `Account was created but sign-in failed (${signErr.message}). Try signing in manually on the customer portal.`,
    };
  }

  await admin.from('customer_portal_invites').update({ used_at: new Date().toISOString() }).eq('token', token);

  redirect('/');
}
