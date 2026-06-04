import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { sendCustomerPortalInviteEmail, isResendApiConfigured } from '@/lib/email/resend';
import { getCustomerPortalOriginForTenant } from '@/lib/portal/customerPortalOrigin';
import { inviteTemplateCustomerFirstName } from '@/lib/tenant/customerIdentityName';

type AdminClient = SupabaseClient<Database>;

const INVITE_TTL_DAYS = 7;

type CustomerIdentityRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  full_name: string | null;
  auth_user_id: string | null;
};

export type CustomerPortalInviteResult =
  | {
      ok: true;
      token: string;
      acceptUrl: string;
      email: string;
      emailed: boolean;
      alreadyLinked: false;
    }
  | { ok: true; alreadyLinked: true; email: string }
  | { ok: false; error: string };

export function buildCompleteInvitePath(
  token: string,
  returnPath?: string | null,
  referralCode?: string | null,
): string {
  const next = returnPath ? sanitizeAuthenticationNext(returnPath) : '/';
  const params = new URLSearchParams({ token });
  if (referralCode?.trim()) {
    params.set('ref', referralCode.trim());
  }
  if (next && next !== '/') {
    params.set('next', next);
  }
  return `/complete-invite?${params.toString()}`;
}

function buildAcceptUrl(portalOrigin: string, token: string, returnPath?: string | null): string {
  return `${portalOrigin}${buildCompleteInvitePath(token, returnPath)}`;
}

async function loadCustomerIdentity(
  admin: AdminClient,
  tenantId: string,
  customerId: string,
): Promise<
  | {
      ok: true;
      identity: CustomerIdentityRow;
      tenantName: string;
    }
  | { ok: false; error: string }
> {
  const { data: row, error: rowErr } = await admin
    .from('customers')
    .select(
      `
      id,
      customer_identities (
        id,
        email,
        first_name,
        full_name,
        auth_user_id
      )
    `,
    )
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (rowErr || !row) {
    return { ok: false, error: 'Customer not found in this workspace.' };
  }

  const rawIdentity = row.customer_identities as unknown;
  const identity = (
    Array.isArray(rawIdentity) ? rawIdentity[0] : rawIdentity
  ) as CustomerIdentityRow | null;

  if (!identity) {
    return { ok: false, error: 'Customer identity is missing.' };
  }

  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();

  if (tErr || !tenant) {
    return { ok: false, error: 'Could not load workspace name.' };
  }

  return {
    ok: true,
    identity,
    tenantName: String(tenant.name ?? 'Your cleaning provider').trim() || 'Your cleaning provider',
  };
}

async function findActiveInviteToken(
  admin: AdminClient,
  customerId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from('customer_portal_invites')
    .select('token')
    .eq('customer_id', customerId)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.token ?? null;
}

async function insertFreshInvite(
  admin: AdminClient,
  input: {
    tenantId: string;
    customerId: string;
    customerIdentityId: string;
    email: string;
    invitedByUserId?: string | null;
  },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + INVITE_TTL_DAYS);

  await admin
    .from('customer_portal_invites')
    .delete()
    .eq('customer_id', input.customerId)
    .is('used_at', null);

  const { data: invite, error: invErr } = await admin
    .from('customer_portal_invites')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      customer_identity_id: input.customerIdentityId,
      email_normalized: input.email,
      invited_by_user_id: input.invitedByUserId ?? null,
      expires_at: expires.toISOString(),
    })
    .select('token')
    .single();

  if (invErr || !invite?.token) {
    return { ok: false, error: invErr?.message ?? 'Could not create invite.' };
  }

  return { ok: true, token: invite.token };
}

/**
 * Ensures a customer has an active portal invite and optionally emails it.
 * Reuses an existing unused invite when not sending email.
 */
export async function ensureCustomerPortalInvite(options: {
  admin: AdminClient;
  tenantId: string;
  customerId: string;
  invitedByUserId?: string | null;
  returnPath?: string | null;
  sendEmail?: boolean;
}): Promise<CustomerPortalInviteResult> {
  const sendEmail = options.sendEmail !== false;

  try {
    await assertTenantFeatureEnabled(options.admin, options.tenantId, 'customerPortal');
  } catch (error) {
    const message = featureGateErrorMessage(error);
    if (message) return { ok: false, error: message };
    throw error;
  }

  const loaded = await loadCustomerIdentity(options.admin, options.tenantId, options.customerId);
  if (!loaded.ok) return loaded;

  const { identity, tenantName } = loaded;
  const email = (identity.email ?? '').trim().toLowerCase();

  if (identity.auth_user_id) {
    return { ok: true, alreadyLinked: true, email: email || identity.email || '' };
  }

  if (!email) {
    return { ok: false, error: 'Add an email address before sending a portal invite.' };
  }

  if (sendEmail && !isResendApiConfigured()) {
    return {
      ok: false,
      error:
        'Email is not configured. Add RESEND_API_KEY to the server environment (Resend dashboard template supplies from/subject for invites).',
    };
  }

  let token = sendEmail ? null : await findActiveInviteToken(options.admin, options.customerId);

  if (!token) {
    const inserted = await insertFreshInvite(options.admin, {
      tenantId: options.tenantId,
      customerId: options.customerId,
      customerIdentityId: identity.id,
      email,
      invitedByUserId: options.invitedByUserId,
    });
    if (!inserted.ok) return inserted;
    token = inserted.token;
  }

  const portalOrigin = await getCustomerPortalOriginForTenant(options.admin, options.tenantId);
  const acceptUrl = buildAcceptUrl(portalOrigin, token, options.returnPath);

  if (!sendEmail) {
    return { ok: true, token, acceptUrl, email, emailed: false, alreadyLinked: false };
  }

  const customerName = inviteTemplateCustomerFirstName(identity);
  const sent = await sendCustomerPortalInviteEmail({
    to: email,
    tenantName,
    customerName,
    createCustomerLink: acceptUrl,
  });

  if (!sent.ok) {
    console.error('[customerPortalInvite] Resend failed:', sent.error);
    await options.admin.from('customer_portal_invites').delete().eq('token', token);
    return { ok: false, error: sent.error };
  }

  return { ok: true, token, acceptUrl, email, emailed: true, alreadyLinked: false };
}

export async function customerHasPortalLogin(
  admin: AdminClient,
  customerId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('customers')
    .select('customer_identities(auth_user_id)')
    .eq('id', customerId)
    .maybeSingle();

  const raw = data?.customer_identities as unknown;
  const identity = (Array.isArray(raw) ? raw[0] : raw) as { auth_user_id: string | null } | null;
  return Boolean(identity?.auth_user_id);
}
