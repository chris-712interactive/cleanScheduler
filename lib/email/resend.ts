/**
 * Resend transactional email (server-only).
 *
 * Configure `RESEND_API_KEY`. For non-template sends (quotes), also set
 * `RESEND_FROM_EMAIL`. Customer portal invites use the Resend template
 * `RESEND_CUSTOMER_INVITE_TEMPLATE_ID` (default `create-customer-account`) with
 * from/subject defined in the dashboard template.
 */
import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';

const DEFAULT_CUSTOMER_INVITE_TEMPLATE_ID = 'create-customer-account';

function resendApiKey(): string | undefined {
  const k = serverEnv.RESEND_API_KEY?.trim();
  return k || undefined;
}

function resendFrom(): string | undefined {
  const f = serverEnv.RESEND_FROM_EMAIL?.trim();
  return f || undefined;
}

/** API key only — enough for template-based portal invites (from/subject live in Resend). */
export function isResendApiConfigured(): boolean {
  return Boolean(resendApiKey());
}

/** API key + from — required for inline HTML/text emails (e.g. quote notifications). */
export function isResendConfigured(): boolean {
  return Boolean(resendApiKey() && resendFrom());
}

function customerInviteTemplateId(): string {
  const id = serverEnv.RESEND_CUSTOMER_INVITE_TEMPLATE_ID?.trim();
  return id || DEFAULT_CUSTOMER_INVITE_TEMPLATE_ID;
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

export interface SendCustomerPortalInviteEmailParams {
  to: string;
  tenantName: string;
  customerName: string;
  createCustomerLink: string;
}

/**
 * Sends the customer portal invite using the Resend dashboard template
 * (from + subject come from the template unless overridden).
 */
export async function sendCustomerPortalInviteEmail(
  params: SendCustomerPortalInviteEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY).' };
  }

  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: 'Recipient address is empty.' };
  }

  const resend = new Resend(apiKey);
  const templateId = customerInviteTemplateId();

  try {
    const { error } = await resend.emails.send({
      to,
      template: {
        id: templateId,
        variables: {
          tenantName: params.tenantName,
          customerName: params.customerName,
          createCustomerLink: params.createCustomerLink,
        },
      },
    });
    if (error) {
      const detail = [error.message, error.name].filter(Boolean).join(' — ');
      console.error('[resend] invite template send failed:', detail);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Resend request failed';
    console.error('[resend] invite template send threw:', msg);
    return { ok: false, error: msg };
  }
}
