import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { customerContactForVisit } from '@/lib/customers/customerContact';
import { emailDeliveryFields, emailBrandForTenant } from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import {
  logVisitCustomerEmail,
  visitCustomerEmailAlreadyLogged,
} from '@/lib/email/visitCustomerEmailLog';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/**
 * Fire-and-forget: thank-you + review CTA after a completed service visit.
 * Skips consultations and when no review URL is configured.
 */
export async function maybeSendVisitReviewRequestEmail(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    customerId: string;
    visitPurpose: string | null;
  },
): Promise<void> {
  try {
    if (params.visitPurpose === 'consultation') return;
    if (!isResendConfigured()) return;

    const plan = await resolveTenantEntitlementPlan(admin, params.tenantId);
    if (!isFeatureEnabled(plan, 'emailReviewRequest')) return;

    const { data: ops } = await admin
      .from('tenant_operational_settings')
      .select('email_notify_review_request')
      .eq('tenant_id', params.tenantId)
      .maybeSingle();
    if (!ops?.email_notify_review_request) return;

    if (
      await visitCustomerEmailAlreadyLogged(admin, {
        tenantId: params.tenantId,
        visitId: params.visitId,
        kind: 'review_request',
      })
    ) {
      return;
    }

    const { data: tenant } = await admin
      .from('tenants')
      .select(
        'name, slug, customer_review_url, brand_color, logo_url, business_phone, business_email, address_line1, city, state, postal_code',
      )
      .eq('id', params.tenantId)
      .maybeSingle();

    const reviewUrl = tenant?.customer_review_url?.trim() || null;
    if (!reviewUrl || !tenant) return;
    const brand = await emailBrandForTenant(admin, params.tenantId, tenant);

    const contact = await customerContactForVisit(admin, params.customerId);
    if (!contact.email) return;

    const tenantName = brand.name;
    const subject = `How did we do? — ${tenantName}`;
    const text = [
      `Hi,`,
      ``,
      `Thank you for choosing ${tenantName}. If you had a great experience, we would really appreciate your feedback.`,
      ``,
      `Leave a review: ${reviewUrl}`,
      ``,
      `Your review helps other customers find reliable cleaning service.`,
      ``,
      `Thank you,`,
      tenantName,
    ].join('\n');

    const html = wrapTransactionalEmailHtml({
      brand,
      preheader: `How did ${tenantName} do?`,
      bodyHtml: `
        <p>Hi,</p>
        <p>Thank you for choosing <strong>${escapeHtmlLite(tenantName)}</strong>. If you had a great experience, we would really appreciate your feedback.</p>
        ${emailButtonHtml({ href: reviewUrl, label: 'Leave a review', color: brand.brandColor })}
        <p>Your review helps other customers find reliable cleaning service.</p>
        <p style="margin:0;">Thank you,<br/>${escapeHtmlLite(tenantName)}</p>
      `.trim(),
    });

    await sendTransactionalEmail({
      to: contact.email,
      subject,
      text,
      html,
      ...emailDeliveryFields(brand),
    });

    await logVisitCustomerEmail(admin, {
      tenantId: params.tenantId,
      visitId: params.visitId,
      kind: 'review_request',
    });
  } catch (err) {
    console.error('[visitReviewRequestEmail]', err);
  }
}
