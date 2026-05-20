import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';

export interface SendCampaignEmailParams {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  tags: { name: string; value: string }[];
}

export async function sendCampaignEmail(
  params: SendCampaignEmailParams,
): Promise<{ ok: true; emailId: string | null } | { ok: false; error: string }> {
  const apiKey = serverEnv.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY).' };
  }

  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: 'Recipient address is empty.' };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: params.from,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      tags: params.tags,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, emailId: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend request failed';
    return { ok: false, error: message };
  }
}

export function campaignFromAddress(tenantName: string, platformFrom: string): string {
  const safeName = tenantName.replace(/"/g, '').trim() || 'Your cleaning team';
  const match = platformFrom.match(/<([^>]+)>/);
  const email = match?.[1] ?? platformFrom.trim();
  return `"${safeName}" <${email}>`;
}
