/**
 * Resend transactional email (server-only).
 *
 * Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (verified domain or
 * onboarding@resend.dev for testing — see Resend dashboard).
 */
import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';

function resendApiKey(): string | undefined {
  const k = serverEnv.RESEND_API_KEY?.trim();
  return k || undefined;
}

function resendFrom(): string | undefined {
  const f = serverEnv.RESEND_FROM_EMAIL?.trim();
  return f || undefined;
}

export function isResendConfigured(): boolean {
  return Boolean(resendApiKey() && resendFrom());
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
  const apiKey = resendApiKey();
  const from = resendFrom();
  if (!apiKey || !from) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).' };
  }

  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: 'Recipient address is empty.' };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    if (error) {
      const detail = [error.message, error.name].filter(Boolean).join(' — ');
      console.error('[resend] emails.send failed:', detail);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Resend request failed';
    console.error('[resend] emails.send threw:', msg);
    return { ok: false, error: msg };
  }
}
