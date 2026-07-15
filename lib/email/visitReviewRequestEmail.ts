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
      .select('name, slug, customer_review_url')
      .eq('id', params.tenantId)
      .maybeSingle();

    const reviewUrl = tenant?.customer_review_url?.trim() || null;
    if (!reviewUrl) return;

    const contact = await customerContactForVisit(admin, params.customerId);
    if (!contact.email) return;

    const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your cleaning team';
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

    const html = `
      <p>Hi,</p>
      <p>Thank you for choosing <strong>${escapeHtml(tenantName)}</strong>. If you had a great experience, we would really appreciate your feedback.</p>
      <p><a href="${escapeAttr(reviewUrl)}">Leave a review</a></p>
      <p>Your review helps other customers find reliable cleaning service.</p>
      <p>Thank you,<br/>${escapeHtml(tenantName)}</p>
    `.trim();

    await sendTransactionalEmail({
      to: contact.email,
      subject,
      text,
      html,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
