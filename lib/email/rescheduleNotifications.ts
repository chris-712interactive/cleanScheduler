import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  platformEmailBrand,
  tenantEmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { publicEnv } from '@/lib/env';

type Admin = SupabaseClient<Database>;

function tenantScheduleUrl(slug: string, path: string): string {
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  return `${proto}://${slug}.${host}${path}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'not specified';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function notifyTenantRescheduleSubmitted(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    customerNote: string;
    preferredStartsAt: string | null;
    preferredEndsAt: string | null;
  },
): Promise<void> {
  if (!isResendConfigured()) return;

  const [{ data: tenant }, { data: profile }, { data: visit }] = await Promise.all([
    admin.from('tenants').select('slug, name').eq('id', params.tenantId).maybeSingle(),
    admin
      .from('tenant_onboarding_profiles')
      .select('owner_email, owner_name')
      .eq('tenant_id', params.tenantId)
      .maybeSingle(),
    admin
      .from('tenant_scheduled_visits')
      .select('title, starts_at')
      .eq('id', params.visitId)
      .maybeSingle(),
  ]);

  const to = profile?.owner_email?.trim();
  if (!to || !tenant?.slug) return;

  const workspace = tenant.name?.trim() || tenant.slug;
  const visitLabel = visit?.title?.trim() || 'Scheduled visit';
  const requestsUrl = tenantScheduleUrl(tenant.slug, '/schedule/reschedule-requests');

  const text = [
    `A customer submitted a reschedule request for ${visitLabel}.`,
    '',
    `Current start: ${formatWhen(visit?.starts_at ?? null)}`,
    params.preferredStartsAt
      ? `Preferred start: ${formatWhen(params.preferredStartsAt)}`
      : 'Preferred start: not specified',
    params.customerNote ? `Customer note: ${params.customerNote}` : null,
    '',
    `Review requests: ${requestsUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    preheader: `Reschedule request — ${visitLabel}`,
    bodyHtml: `
      <p>A customer submitted a reschedule request for <strong>${escapeHtmlLite(visitLabel)}</strong>.</p>
      <ul>
        <li>Current start: ${escapeHtmlLite(formatWhen(visit?.starts_at ?? null))}</li>
        <li>Preferred start: ${escapeHtmlLite(formatWhen(params.preferredStartsAt))}</li>
        ${params.customerNote ? `<li>Customer note: ${escapeHtmlLite(params.customerNote)}</li>` : ''}
      </ul>
      ${emailButtonHtml({ href: requestsUrl, label: 'Review reschedule requests' })}
    `.trim(),
  });

  await sendTransactionalEmail({
    to,
    subject: `${workspace}: reschedule request submitted`,
    text,
    html,
    ...emailDeliveryFields(platformEmailBrand()),
  });
}

export async function notifyCustomerRescheduleResolved(
  admin: Admin,
  params: {
    tenantId: string;
    customerId: string;
    visitId: string;
    resolution: 'completed' | 'declined';
    tenantNote: string | null;
    appliedStartsAt: string | null;
  },
): Promise<void> {
  if (!isResendConfigured()) return;

  const [brandLoaded, { data: cust }, { data: visit }] = await Promise.all([
    loadTenantEmailBrand(admin, params.tenantId),
    admin
      .from('customers')
      .select('customer_identities ( email )')
      .eq('id', params.customerId)
      .maybeSingle(),
    admin
      .from('tenant_scheduled_visits')
      .select('title, starts_at')
      .eq('id', params.visitId)
      .maybeSingle(),
  ]);

  const email = (cust?.customer_identities as { email: string | null } | null)?.email?.trim();
  if (!email) return;

  const brand = brandLoaded ?? tenantEmailBrand({ name: 'Your provider' });
  const provider = brand.name;
  const visitLabel = visit?.title?.trim() || 'your visit';
  const approved = params.resolution === 'completed';

  const text = [
    `${provider} ${approved ? 'approved' : 'declined'} your reschedule request for ${visitLabel}.`,
    approved && params.appliedStartsAt ? `New time: ${formatWhen(params.appliedStartsAt)}` : null,
    params.tenantNote ? `Message from provider: ${params.tenantNote}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: `${provider} responded to your reschedule request`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(provider)}</strong> ${approved ? 'approved' : 'declined'} your reschedule request for <strong>${escapeHtmlLite(visitLabel)}</strong>.</p>
      ${
        approved && params.appliedStartsAt
          ? `<p>New time: <strong>${escapeHtmlLite(formatWhen(params.appliedStartsAt))}</strong></p>`
          : ''
      }
      ${params.tenantNote ? `<p>Message from provider: ${escapeHtmlLite(params.tenantNote)}</p>` : ''}
    `.trim(),
  });

  await sendTransactionalEmail({
    to: email,
    subject: `${provider}: reschedule request ${approved ? 'approved' : 'declined'}`,
    text,
    html,
    ...emailDeliveryFields(brand),
  });
}
