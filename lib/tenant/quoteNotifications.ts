import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  platformEmailBrand,
  tenantEmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';
import {
  emailButtonHtml,
  emailFactsHtml,
  wrapTransactionalEmailHtml,
} from '@/lib/email/transactionalEmailLayout';
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

async function quoteUrlForCustomer(
  admin: Admin,
  tenantId: string,
  quoteId: string,
): Promise<string> {
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

  const loadedBrand = await loadTenantEmailBrand(admin, params.tenantId);
  const tname = loadedBrand?.name || (await tenantName(admin, params.tenantId));
  const brand = loadedBrand ?? tenantEmailBrand({ name: tname });
  const platformDelivery = emailDeliveryFields(platformEmailBrand());
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
    const ctaLabel = hasLogin ? 'View and respond' : 'Create your account and view the quote';
    const html = wrapTransactionalEmailHtml({
      brand,
      preheader: `New quote from ${tname}`,
      bodyHtml: `
        <p>You have a new quote from <strong>${escapeHtmlLite(tname)}</strong>.</p>
        <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#102122;">${escapeHtmlLite(params.quoteTitle)}</p>
        ${emailButtonHtml({ href: link, label: ctaLabel, color: brand.brandColor })}
        ${
          hasLogin
            ? ''
            : `<p style="margin:0;font-size:13px;line-height:1.5;color:#5c6f6e;">Use the email address your provider has on file (${escapeHtmlLite(customerEmail)}).</p>`
        }
      `.trim(),
    });
    const sent = await sendTransactionalEmail({
      to: customerEmail,
      subject,
      text,
      html,
      ...emailDeliveryFields(brand),
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_sent email failed:', sent.error);
    }
    return;
  }

  if (event === 'quote_accepted' && flags.email_accepted && staffEmail) {
    const subject = `Quote accepted: ${params.quoteTitle}`;
    const text = `A customer accepted a quote.\n\nTitle: ${params.quoteTitle}\nQuote ID: ${params.quoteId}\n`;
    const html = wrapTransactionalEmailHtml({
      preheader: `Quote accepted — ${params.quoteTitle}`,
      bodyHtml: `
        <p>A customer accepted a quote.</p>
        ${emailFactsHtml([
          { label: 'Quote', value: params.quoteTitle },
          { label: 'Quote ID', value: params.quoteId },
        ])}
      `.trim(),
    });
    const sent = await sendTransactionalEmail({
      to: staffEmail,
      subject,
      text,
      html,
      ...platformDelivery,
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_accepted email failed:', sent.error);
    }
    return;
  }

  if (event === 'quote_declined' && flags.email_declined && staffEmail) {
    const subject = `Quote declined: ${params.quoteTitle}`;
    const text = `A customer declined a quote.\n\nTitle: ${params.quoteTitle}\nQuote ID: ${params.quoteId}\n`;
    const html = wrapTransactionalEmailHtml({
      preheader: `Quote declined — ${params.quoteTitle}`,
      bodyHtml: `
        <p>A customer declined a quote.</p>
        ${emailFactsHtml([
          { label: 'Quote', value: params.quoteTitle },
          { label: 'Quote ID', value: params.quoteId },
        ])}
      `.trim(),
    });
    const sent = await sendTransactionalEmail({
      to: staffEmail,
      subject,
      text,
      html,
      ...platformDelivery,
    });
    if (!sent.ok) {
      console.error('[quoteNotifications] quote_declined email failed:', sent.error);
    }
  }
}
