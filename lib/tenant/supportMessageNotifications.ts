import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

export type CustomerSupportMessageEvent = 'thread_created' | 'customer_reply';

async function loadNotifyFlag(admin: Admin, tenantId: string): Promise<boolean> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('email_notify_customer_message')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!data) return true;
  return data.email_notify_customer_message;
}

async function tenantStaffEmail(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('tenant_onboarding_profiles')
    .select('owner_email, company_email')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const owner = (data?.owner_email ?? '').trim().toLowerCase();
  if (owner) return owner;
  const company = (data?.company_email ?? '').trim().toLowerCase();
  return company || null;
}

async function customerDisplayName(admin: Admin, customerId: string): Promise<string> {
  const { data } = await admin
    .from('customers')
    .select('customer_identities ( first_name, last_name, full_name )')
    .eq('id', customerId)
    .maybeSingle();

  const ident = (
    data as {
      customer_identities: {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      } | null;
    } | null
  )?.customer_identities;

  if (!ident || !customerHasAnyNameParts(ident)) return 'A customer';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? 'A customer' : name;
}

async function tenantMessagesUrl(
  admin: Admin,
  tenantId: string,
  threadId: string,
): Promise<string | null> {
  const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  const slug = data?.slug?.trim();
  if (!slug) return null;
  return `${getPublicOrigin(slug)}/messages?thread=${threadId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function previewBody(body: string, max = 280): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Emails tenant staff when a customer starts or replies to a support thread.
 * Failures are logged and do not throw.
 */
export async function sendCustomerSupportMessageNotification(
  admin: Admin,
  event: CustomerSupportMessageEvent,
  params: {
    tenantId: string;
    threadId: string;
    customerId: string;
    subject: string;
    body: string;
  },
): Promise<void> {
  if (!isResendConfigured()) {
    console.warn(
      '[supportMessageNotifications] Skipping email: Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).',
    );
    return;
  }

  const enabled = await loadNotifyFlag(admin, params.tenantId);
  if (!enabled) return;

  const staffEmail = await tenantStaffEmail(admin, params.tenantId);
  if (!staffEmail) return;

  const [customerName, inboxUrl] = await Promise.all([
    customerDisplayName(admin, params.customerId),
    tenantMessagesUrl(admin, params.tenantId, params.threadId),
  ]);

  const actionLabel = event === 'thread_created' ? 'sent a new message' : 'replied';
  const subjectLine = `Customer message: ${params.subject}`;
  const preview = previewBody(params.body);
  const linkLine = inboxUrl ? `\n\nOpen in your workspace: ${inboxUrl}` : '';
  const text = `${customerName} ${actionLabel} in the customer portal.\n\nSubject: ${params.subject}\n\n${preview}${linkLine}\n`;
  const htmlLink = inboxUrl
    ? `<p><a href="${inboxUrl}">Open conversation</a></p>`
    : '<p>Sign in to your workspace and open Messages.</p>';
  const html = `<p><strong>${escapeHtml(customerName)}</strong> ${actionLabel} in the customer portal.</p><p><strong>${escapeHtml(params.subject)}</strong></p><p>${escapeHtml(preview)}</p>${htmlLink}`;

  const sent = await sendTransactionalEmail({
    to: staffEmail,
    subject: subjectLine,
    text,
    html,
  });

  if (!sent.ok) {
    console.error('[supportMessageNotifications] email failed:', sent.error);
  }
}
