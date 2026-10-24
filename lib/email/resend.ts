/**
 * Resend transactional email (server-only).
 *
 * Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. The inbox display name
 * follows the email brand (the cleaning company, or Clean Scheduler).
 */
import { Resend } from 'resend';
import {
  emailFromName,
  emailReplyTo,
  tenantEmailBrand,
  type TenantEmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { formatEmailFromAddress } from '@/lib/email/fromAddress';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';
import { serverEnv } from '@/lib/env';

function resendApiKey(): string | undefined {
  const k = serverEnv.RESEND_API_KEY?.trim();
  return k || undefined;
}

function resendFrom(): string | undefined {
  const f = serverEnv.RESEND_FROM_EMAIL?.trim();
  return f || undefined;
}

/** API key only. Inline mail also needs {@link isResendConfigured}. */
export function isResendApiConfigured(): boolean {
  return Boolean(resendApiKey());
}

/** API key + from — required for inline HTML/text emails (e.g. quote notifications). */
export function isResendConfigured(): boolean {
  return Boolean(resendApiKey() && resendFrom());
}

export interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Inbox display name. The address stays the verified `RESEND_FROM_EMAIL`. */
  fromName?: string;
  replyTo?: string;
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
  const fromName = params.fromName?.trim();
  const replyTo = params.replyTo?.trim();

  try {
    const { error } = await resend.emails.send({
      from: fromName ? formatEmailFromAddress(fromName, from) : from,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      ...(replyTo ? { replyTo } : {}),
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
  brand: TenantEmailBrand;
  customerName: string;
  createCustomerLink: string;
}

/** Customer portal invite, branded as the cleaning company. */
export async function sendCustomerPortalInviteEmail(
  params: SendCustomerPortalInviteEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const greeting = params.customerName.trim() || 'there';
  const business = params.brand.name;
  const subject = `${business} invited you to your customer portal`;
  const text = [
    `Hi ${greeting},`,
    '',
    `${business} invited you to view visits, invoices, and messages in your customer portal.`,
    '',
    `Create your account: ${params.createCustomerLink}`,
    '',
    'This link expires in 7 days.',
  ].join('\n');

  const html = wrapTransactionalEmailHtml({
    brand: params.brand,
    preheader: `Create your ${business} customer portal account`,
    bodyHtml: `
      <p>Hi ${escapeHtmlLite(greeting)},</p>
      <p><strong>${escapeHtmlLite(business)}</strong> invited you to view visits, invoices, and messages in your customer portal.</p>
      ${emailButtonHtml({
        href: params.createCustomerLink,
        label: 'Create your account',
        color: params.brand.brandColor,
      })}
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6f6e;">This link expires in 7 days.</p>
    `.trim(),
  });

  return sendTransactionalEmail({
    to: params.to,
    subject,
    text,
    html,
    fromName: emailFromName(params.brand),
    replyTo: emailReplyTo(params.brand),
  });
}

export interface SendEmployeeInviteEmailParams {
  to: string;
  tenantName: string;
  roleLabel: string;
  acceptUrl: string;
  workspaceUrl: string;
  brand?: TenantEmailBrand;
}

/** Team invite. The header is the cleaning company; the account lives on Clean Scheduler. */
export async function sendEmployeeInviteEmail(
  params: SendEmployeeInviteEmailParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const brand = params.brand ?? tenantEmailBrand({ name: params.tenantName });
  const subject = `You're invited to ${brand.name} on Clean Scheduler`;
  const text = [
    `${brand.name} invited you as ${params.roleLabel}.`,
    '',
    'Create your password and join the team:',
    params.acceptUrl,
    '',
    'After you finish, sign in to the workspace at:',
    params.workspaceUrl,
    '',
    'This link expires in 7 days.',
  ].join('\n');

  const html = wrapTransactionalEmailHtml({
    brand,
    preheader: `${brand.name} invited you as ${params.roleLabel}`,
    bodyHtml: `
      <p><strong>${escapeHtmlLite(brand.name)}</strong> invited you to join the team as <strong>${escapeHtmlLite(params.roleLabel)}</strong>.</p>
      ${emailButtonHtml({
        href: params.acceptUrl,
        label: 'Create your account',
        color: brand.brandColor,
      })}
      <p>After you set a password, sign in at <a href="${escapeHtmlLite(params.workspaceUrl)}">${escapeHtmlLite(params.workspaceUrl)}</a>.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6f6e;">This link expires in 7 days.</p>
    `.trim(),
  });

  return sendTransactionalEmail({
    to: params.to,
    subject,
    text,
    html,
    fromName: emailFromName(brand),
    replyTo: emailReplyTo(brand),
  });
}
