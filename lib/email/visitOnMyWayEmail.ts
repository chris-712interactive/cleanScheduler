import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { customerContactForVisit } from '@/lib/customers/customerContact';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import {
  logVisitCustomerEmail,
  visitCustomerEmailAlreadyLogged,
} from '@/lib/email/visitCustomerEmailLog';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

function formatVisitWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Fire-and-forget: email the customer when crew checks in ("we're on our way").
 * Never throws to the caller — check-in must succeed even if email fails.
 */
export async function maybeSendVisitOnMyWayEmail(
  admin: Admin,
  params: { tenantId: string; visitId: string; customerId: string },
): Promise<void> {
  try {
    if (!isResendConfigured()) return;

    const plan = await resolveTenantEntitlementPlan(admin, params.tenantId);
    if (!isFeatureEnabled(plan, 'emailOnMyWay')) return;

    const { data: ops } = await admin
      .from('tenant_operational_settings')
      .select('email_notify_on_my_way')
      .eq('tenant_id', params.tenantId)
      .maybeSingle();
    if (!ops?.email_notify_on_my_way) return;

    if (
      await visitCustomerEmailAlreadyLogged(admin, {
        tenantId: params.tenantId,
        visitId: params.visitId,
        kind: 'on_my_way',
      })
    ) {
      return;
    }

    const contact = await customerContactForVisit(admin, params.customerId);
    if (!contact.email) return;

    const [{ data: tenant }, { data: visit }] = await Promise.all([
      admin
        .from('tenants')
        .select('name, slug, business_phone')
        .eq('id', params.tenantId)
        .maybeSingle(),
      admin
        .from('tenant_scheduled_visits')
        .select('title, starts_at')
        .eq('id', params.visitId)
        .eq('tenant_id', params.tenantId)
        .maybeSingle(),
    ]);

    const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your cleaning team';
    const phone = tenant?.business_phone?.trim() || null;
    const when = visit?.starts_at ? formatVisitWhen(visit.starts_at) : null;
    const title = visit?.title?.trim() || 'your cleaning';

    const subject = `${tenantName} is on the way`;
    const textLines = [
      `Hi,`,
      ``,
      `Our team from ${tenantName} has checked in and is on the way for ${title}.`,
      when ? `Scheduled for: ${when}` : null,
      phone ? `Questions? Call us at ${phone}.` : null,
      ``,
      `Thank you,`,
      tenantName,
    ].filter((line): line is string => line != null);

    const html = `
      <p>Hi,</p>
      <p>Our team from <strong>${escapeHtml(tenantName)}</strong> has checked in and is on the way for ${escapeHtml(title)}.</p>
      ${when ? `<p>Scheduled for: ${escapeHtml(when)}</p>` : ''}
      ${phone ? `<p>Questions? Call us at ${escapeHtml(phone)}.</p>` : ''}
      <p>Thank you,<br/>${escapeHtml(tenantName)}</p>
    `.trim();

    await sendTransactionalEmail({
      to: contact.email,
      subject,
      text: textLines.join('\n'),
      html,
    });

    await logVisitCustomerEmail(admin, {
      tenantId: params.tenantId,
      visitId: params.visitId,
      kind: 'on_my_way',
    });
  } catch (err) {
    console.error('[visitOnMyWayEmail]', err);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
