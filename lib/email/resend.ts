/**
 * Resend transactional email (server-only).
 *
 * Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (verified domain or
 * onboarding@resend.dev for testing — see Resend dashboard).
 */
import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';

export function isResendConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY && serverEnv.RESEND_FROM_EMAIL);
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
  const apiKey = serverEnv.RESEND_API_KEY;
  const from = serverEnv.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).' };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Resend request failed';
    return { ok: false, error: msg };
  }
}
