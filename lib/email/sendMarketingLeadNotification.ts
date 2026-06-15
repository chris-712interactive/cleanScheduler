import { sendTransactionalEmail, isResendConfigured } from '@/lib/email/resend';

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

  const html = text.replace(/\n/g, '<br />');

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}
