'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { sendTransactionalEmail, isSendgridConfigured } from '@/lib/email/sendgrid';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export interface CustomerInviteFormState {
  error?: string;
  success?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendCustomerPortalInviteAction(
  _prev: CustomerInviteFormState,
  formData: FormData,
): Promise<CustomerInviteFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();

  if (!slug || !customerId) {
    return { error: 'Missing workspace or customer.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const auth = await getAuthContext();
  if (!auth) {
    return { error: 'You must be signed in to send an invite.' };
  }

  if (!isSendgridConfigured()) {
    return {
      error:
        'Email is not configured. Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL (verified sender) to the server environment.',
    };
  }

  const admin = createAdminClient();
  const { data: row, error: rowErr } = await admin
    .from('customers')
    .select(
      `
      id,
      customer_identities (
        id,
        email,
        full_name,
        auth_user_id
      )
    `,
    )
    .eq('id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (rowErr || !row) {
    return { error: 'Customer not found in this workspace.' };
  }

  const rawIdentity = row.customer_identities as unknown;
  const identity = (
    Array.isArray(rawIdentity) ? rawIdentity[0] : rawIdentity
  ) as {
    id: string;
    email: string | null;
    full_name: string | null;
    auth_user_id: string | null;
  } | null;

  if (!identity) {
    return { error: 'Customer identity is missing.' };
  }

  if (identity.auth_user_id) {
    return { error: 'This customer already has a portal login linked.' };
  }

  const email = (identity.email ?? '').trim().toLowerCase();
  if (!email) {
    return { error: 'Add an email address on the customer profile before sending an invite.' };
  }

  const { data: tenant, error: tErr } = await admin.from('tenants').select('name').eq('id', membership.tenantId).maybeSingle();
  if (tErr || !tenant) {
    return { error: 'Could not load workspace name.' };
  }

  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 7);

  await admin.from('customer_portal_invites').delete().eq('customer_id', customerId).is('used_at', null);

  const { data: invite, error: invErr } = await admin
    .from('customer_portal_invites')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: customerId,
      customer_identity_id: identity.id,
      email_normalized: email,
      invited_by_user_id: auth.user.id,
      expires_at: expires.toISOString(),
    })
    .select('token')
    .single();

  if (invErr || !invite?.token) {
    return { error: invErr?.message ?? 'Could not create invite.' };
  }

  const acceptUrl = `${getPublicOrigin('my')}/complete-invite?token=${invite.token}`;
  const tenantName = escapeHtml(String(tenant.name ?? 'Your cleaning provider'));
  const recipientName = escapeHtml((identity.full_name ?? '').trim() || 'there');
  const subject = `You’re invited to the cleanScheduler customer portal — ${tenant.name ?? 'your provider'}`;

  const text = [
    `Hi ${identity.full_name?.trim() || 'there'},`,
    '',
    `${tenant.name ?? 'Your cleaning provider'} invited you to create your cleanScheduler customer portal account.`,
    'Use this link (expires in 7 days):',
    acceptUrl,
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n');

  const html = `
    <p>Hi ${recipientName},</p>
    <p><strong>${tenantName}</strong> invited you to create your <strong>cleanScheduler</strong> customer portal account so you can view visits, invoices, and messages in one place.</p>
    <p><a href="${acceptUrl}">Accept invite and set your password</a></p>
    <p style="color:#666;font-size:14px;">This link expires in 7 days. If you did not expect this message, you can ignore it.</p>
  `.trim();

  const sent = await sendTransactionalEmail({ to: email, subject, text, html });
  if (!sent.ok) {
    await admin.from('customer_portal_invites').delete().eq('token', invite.token);
    return { error: sent.error };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  return { success: `Invite sent to ${email}.` };
}
