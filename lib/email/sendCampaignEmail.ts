import { formatEmailFromAddress } from '@/lib/email/fromAddress';
import { createResendClient } from '@/lib/email/resendClient';
import { serverEnv } from '@/lib/env';
import {
  isOutboundSuppressed,
  logOutboundSuppressed,
  OUTBOUND_SUPPRESSED_MESSAGE,
} from '@/lib/outbound/suppression';

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
  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: 'Recipient address is empty.' };
  }
  if (isOutboundSuppressed()) {
    logOutboundSuppressed('resend', 'emails.send');
    return { ok: false, error: OUTBOUND_SUPPRESSED_MESSAGE };
  }

  const apiKey = serverEnv.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY).' };
  }

  const resend = createResendClient(apiKey);

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
  return formatEmailFromAddress(tenantName.trim() || 'Your cleaning team', platformFrom);
}
