import { emailDeliveryFields, platformEmailBrand } from '@/lib/email/emailBrand';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { PRODUCT_NAME } from '@/lib/legal/site';

/**
 * Fire-and-forget welcome after free-trial signup. Not an Auth confirmation —
 * the owner can sign in immediately. Skips when Resend is unconfigured.
 */
export async function maybeSendTrialWelcomeEmail(params: {
  to: string;
  ownerName: string;
  businessName: string;
  slug: string;
  trialDays: number;
}): Promise<void> {
  try {
    if (!isResendConfigured()) return;

    const workspaceUrl = `${getPublicOrigin(params.slug)}/`;
    const greeting = params.ownerName.trim() || 'there';
    const business = params.businessName.trim() || 'your workspace';
    const subject = `Welcome to ${PRODUCT_NAME} — your trial is ready`;

    const text = [
      `Hi ${greeting},`,
      ``,
      `Your ${PRODUCT_NAME} workspace for ${business} is ready.`,
      `You have ${params.trialDays} days to explore scheduling, quotes, and invoicing.`,
      ``,
      `Open your workspace: ${workspaceUrl}`,
      ``,
      `No email confirmation is required — sign in with the password you chose at signup.`,
      ``,
      `— ${PRODUCT_NAME}`,
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${escapeHtmlLite(greeting)},</p>
      <p>Your <strong>${escapeHtmlLite(PRODUCT_NAME)}</strong> workspace for <strong>${escapeHtmlLite(business)}</strong> is ready.</p>
      <p>You have ${params.trialDays} days to explore scheduling, quotes, and invoicing.</p>
      ${emailButtonHtml({ href: workspaceUrl, label: 'Open your workspace' })}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6f6e;">No email confirmation is required — sign in with the password you chose at signup.</p>
    `.trim();

    await sendTransactionalEmail({
      to: params.to,
      subject,
      text,
      html: wrapTransactionalEmailHtml({
        preheader: `${business} is ready — open your workspace`,
        bodyHtml,
      }),
      ...emailDeliveryFields(platformEmailBrand()),
    });
  } catch (err) {
    console.error('[trialWelcomeEmail] failed', err);
  }
}
