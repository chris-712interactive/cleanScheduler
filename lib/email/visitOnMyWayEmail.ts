import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { customerContactForVisit } from '@/lib/customers/customerContact';
import {
  emailDeliveryFields,
  loadTenantEmailBrand,
  tenantEmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { emailFactsHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
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

export type OnMyWayEmailResult =
  | { sent: true }
  | {
      sent: false;
      reason: 'not_configured' | 'plan' | 'disabled' | 'already_sent' | 'no_email' | 'failed';
    };

/**
 * Email the customer that the crew is heading to the appointment.
 * Never throws — callers decide how to surface a skipped or failed send.
 */
export async function maybeSendVisitOnMyWayEmail(
  admin: Admin,
  params: { tenantId: string; visitId: string; customerId: string },
): Promise<OnMyWayEmailResult> {
  try {
    if (!isResendConfigured()) return { sent: false, reason: 'not_configured' };

    const plan = await resolveTenantEntitlementPlan(admin, params.tenantId);
    if (!isFeatureEnabled(plan, 'emailOnMyWay')) return { sent: false, reason: 'plan' };

    const { data: ops } = await admin
      .from('tenant_operational_settings')
      .select('email_notify_on_my_way')
      .eq('tenant_id', params.tenantId)
      .maybeSingle();
    if (!ops?.email_notify_on_my_way) return { sent: false, reason: 'disabled' };

    if (
      await visitCustomerEmailAlreadyLogged(admin, {
        tenantId: params.tenantId,
        visitId: params.visitId,
        kind: 'on_my_way',
      })
    ) {
      return { sent: false, reason: 'already_sent' };
    }

    const contact = await customerContactForVisit(admin, params.customerId);
    if (!contact.email) return { sent: false, reason: 'no_email' };

    const [brandLoaded, { data: visit }] = await Promise.all([
      loadTenantEmailBrand(admin, params.tenantId),
      admin
        .from('tenant_scheduled_visits')
        .select('title, starts_at')
        .eq('id', params.visitId)
        .eq('tenant_id', params.tenantId)
        .maybeSingle(),
    ]);

    const brand = brandLoaded ?? tenantEmailBrand({ name: 'Your cleaning team' });
    const tenantName = brand.name;
    const phone = brand.phone;
    const when = visit?.starts_at ? formatVisitWhen(visit.starts_at) : null;
    const title = visit?.title?.trim() || 'your cleaning';

    const subject = `${tenantName} is on the way`;
    const textLines = [
      `Hi,`,
      ``,
      `Our team from ${tenantName} is on the way for ${title}.`,
      when ? `Scheduled for: ${when}` : null,
      phone ? `Questions? Call us at ${phone}.` : null,
      ``,
      `Thank you,`,
      tenantName,
    ].filter((line): line is string => line != null);

    const html = wrapTransactionalEmailHtml({
      brand,
      preheader: `${tenantName} is on the way`,
      bodyHtml: `
        <p>Hi,</p>
        <p>Our team from <strong>${escapeHtmlLite(tenantName)}</strong> is on the way for ${escapeHtmlLite(title)}.</p>
        ${when ? emailFactsHtml([{ label: 'Scheduled for', value: when }]) : ''}
        ${phone ? `<p>Questions? Call us at ${escapeHtmlLite(phone)}.</p>` : ''}
        <p style="margin:0;">Thank you,<br/>${escapeHtmlLite(tenantName)}</p>
      `.trim(),
    });

    const delivered = await sendTransactionalEmail({
      to: contact.email,
      subject,
      text: textLines.join('\n'),
      html,
      ...emailDeliveryFields(brand),
    });
    if (!delivered.ok) return { sent: false, reason: 'failed' };

    await logVisitCustomerEmail(admin, {
      tenantId: params.tenantId,
      visitId: params.visitId,
      kind: 'on_my_way',
    });
    return { sent: true };
  } catch (err) {
    console.error('[visitOnMyWayEmail]', err);
    return { sent: false, reason: 'failed' };
  }
}
