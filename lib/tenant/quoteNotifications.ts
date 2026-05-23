import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';
import {
  customerHasPortalLogin,
  ensureCustomerPortalInvite,
} from '@/lib/tenant/customerPortalInvite';

type Admin = SupabaseClient<Database>;

export type QuoteNotificationEvent = 'quote_sent' | 'quote_accepted' | 'quote_declined';

async function loadOpsFlags(
  admin: Admin,
  tenantId: string,
): Promise<{
  email_sent: boolean;
  email_accepted: boolean;
  email_declined: boolean;
} | null> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('email_notify_quote_sent, email_notify_quote_accepted, email_notify_quote_declined')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!data) {
    return {
      email_sent: true,
      email_accepted: true,
      email_declined: true,
    };
  }
  return {
    email_sent: data.email_notify_quote_sent,
    email_accepted: data.email_notify_quote_accepted,
    email_declined: data.email_notify_quote_declined,
  };
}

async function tenantStaffEmail(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_email, company_email')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const o = (data?.owner_email ?? '').trim().toLowerCase();
  if (o) return o;
  const c = (data?.company_email ?? '').trim().toLowerCase();
  return c || null;
}

async function customerIdentityEmail(admin: Admin, customerId: string): Promise<string | null> {
  const { data } = await admin
    .from('customers')
    .select('customer_identities(email)')
    .eq('id', customerId)
    .maybeSingle();
  const row = data as { customer_identities: { email: string | null } | null } | null;
  const e = (row?.customer_identities?.email ?? '').trim().toLowerCase();
  return e || null;
}

async function tenantName(admin: Admin, tenantId: string): Promise<string> {
  const { data } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
  return (data?.name ?? '').trim() || 'Your provider';
}

async function quoteUrlForCustomer(admin: Admin, tenantId: string, quoteId: string): Promise<string> {
  return customerPortalUrlForTenant(admin, tenantId, `/quotes/${quoteId}`);
}

/**
 * Sends quote-related mail via Resend. Callers should **await** this in server actions
 * so serverless runtimes do not freeze before the request finishes (floating promises are dropped).
 * Failures are logged and do not throw.
 */
export async function sendQuoteNotificationEmail(
  admin: Admin,
  event: QuoteNotificationEvent,
  params: { tenantId: string; quoteId: string; quoteTitle: string; customerId: string },
): Promise<void> {
  if (!isResendConfigured()) {
    console.warn(
      '[quoteNotifications] Skipping email: Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).',
    );
    return;
  }

  const flags = await loadOpsFlags(admin, params.tenantId);
  if (!flags) return;

  const tname = await tenantName(admin, params.tenantId);
  const staffEmail = await tenantStaffEmail(admin, params.tenantId);
  const customerEmail = await customerIdentityEmail(admin, params.customerId);
  const hasLogin = await customerHasPortalLogin(admin, params.customerId);
  const quotePath = `/quotes/${params.quoteId}`;

  let link = await quoteUrlForCustomer(admin, params.tenantId, params.quoteId);

  if (event === 'quote_sent' && flags.email_sent && customerEmail && !hasLogin) {
    const invite = await ensureCustomerPortalInvite({
      admin,
      tenantId: params.tenantId,
      customerId: params.customerId,
      returnPath: quotePath,
      sendEmail: false,
    });
    if (invite.ok && !invite.alreadyLinked) {
      link = invite.acceptUrl;
    }
  }

  if (event === 'quote_sent' && flags.email_sent && customerEmail) {
    const subject = `Quote from ${tname}: ${params.quoteTitle}`;
    const setupHint = hasLogin
      ? ''
      : '\n\nYou will need to finish setting up your customer portal account before you can view this quote.';
    const text = `You have a new quote from ${tname}.\n\nTitle: ${params.quoteTitle}\n\nView and respond: ${link}${setupHint}\n`;
    const html = hasLogin
      ? `<p>You have a new quote from <strong>${escapeHtml(tname)}</strong>.</p><p><strong>${escapeHtml(params.quoteTitle)}</strong></p><p><a href="${link}">View and respond</a></p>`
      : `<p>You have a new quote from <strong>${escapeHtml(tname)}</strong>.</p><p><strong>${escapeHtml(params.quoteTitle)}</strong></p><p><a href="${link}">Create your account &amp; view quote</a></p><p>Use the same email address your provider has on file (${escapeHtml(customerEmail)}).</p>`;
    const sent = await sendTransactionalEmail({ to: customerEmail, subject, text, html });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_sent email failed:', sent.error);
    }
    return;
  }

  if (event === 'quote_accepted' && flags.email_accepted && staffEmail) {
    const subject = `Quote accepted: ${params.quoteTitle}`;
    const text = `A customer accepted a quote.\n\nTitle: ${params.quoteTitle}\nQuote ID: ${params.quoteId}\n`;
    const html = `<p>A customer accepted a quote.</p><p><strong>${escapeHtml(params.quoteTitle)}</strong></p><p>Quote ID: <code>${escapeHtml(params.quoteId)}</code></p>`;
    const sent = await sendTransactionalEmail({ to: staffEmail, subject, text, html });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_accepted email failed:', sent.error);
    }
    return;
  }

  if (event === 'quote_declined' && flags.email_declined && staffEmail) {
    const subject = `Quote declined: ${params.quoteTitle}`;
    const text = `A customer declined a quote.\n\nTitle: ${params.quoteTitle}\nQuote ID: ${params.quoteId}\n`;
    const html = `<p>A customer declined a quote.</p><p><strong>${escapeHtml(params.quoteTitle)}</strong></p><p>Quote ID: <code>${escapeHtml(params.quoteId)}</code></p>`;
    const sent = await sendTransactionalEmail({ to: staffEmail, subject, text, html });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_declined email failed:', sent.error);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
