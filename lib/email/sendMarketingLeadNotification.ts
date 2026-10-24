import { emailDeliveryFields, platformEmailBrand } from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';
import { emailFactsHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';

export async function sendMarketingLeadNotificationEmail(input: {
  to: string;
  tenantName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  message: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: 'Email is not configured.' };
  }

  const subject = `New website lead — ${input.leadName}`;
  const text = [
    `You have a new lead from your ${input.tenantName} website.`,
    '',
    `Name: ${input.leadName}`,
    `Email: ${input.leadEmail}`,
    input.leadPhone ? `Phone: ${input.leadPhone}` : null,
    input.message ? `Message: ${input.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapTransactionalEmailHtml({
    preheader: `New website lead — ${input.leadName}`,
    bodyHtml: `
      <p>You have a new lead from your <strong>${escapeHtmlLite(input.tenantName)}</strong> website.</p>
      ${emailFactsHtml(
        [
          { label: 'Name', value: input.leadName },
          { label: 'Email', value: input.leadEmail },
          input.leadPhone ? { label: 'Phone', value: input.leadPhone } : null,
          input.message ? { label: 'Message', value: input.message } : null,
        ].filter((row): row is { label: string; value: string } => row !== null),
      )}
    `.trim(),
  });

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
    ...emailDeliveryFields(platformEmailBrand()),
  });
}
