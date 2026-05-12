/**
 * Twilio SendGrid transactional email (server-only).
 *
 * Configure `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` (verified sender in SendGrid).
 */
import sgMail from '@sendgrid/mail';
import { serverEnv } from '@/lib/env';

export function isSendgridConfigured(): boolean {
  return Boolean(serverEnv.SENDGRID_API_KEY && serverEnv.SENDGRID_FROM_EMAIL);
}

export interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = serverEnv.SENDGRID_API_KEY;
  const from = serverEnv.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: 'SendGrid is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL).' };
  }

  sgMail.setApiKey(apiKey);

  try {
    await sgMail.send({
      to: params.to,
      from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { ok: true };
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object'
        ? JSON.stringify((e as { response: { body?: unknown } }).response.body ?? e)
        : e instanceof Error
          ? e.message
          : 'SendGrid request failed';
    return { ok: false, error: msg };
  }
}
