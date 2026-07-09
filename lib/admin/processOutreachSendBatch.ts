import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOutreachEmailContent } from '@/lib/admin/outreachEmailBody';
import {
  finalizeOutreachCampaignIfDrained,
  refreshOutreachCampaignMetrics,
} from '@/lib/admin/outreachMetrics';
import { OUTREACH_SEND_BATCH_SIZE } from '@/lib/admin/outreachTypes';
import { createOutreachUnsubscribeToken } from '@/lib/admin/outreachUnsubscribeToken';
import { sendCampaignEmail } from '@/lib/email/sendCampaignEmail';
import { serverEnv } from '@/lib/env';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export async function processOutreachSendBatch(
  admin: AdminClient,
  options?: { batchSize?: number },
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  campaignsTouched: string[];
}> {
  const batchSize = options?.batchSize ?? OUTREACH_SEND_BATCH_SIZE;
  const from = serverEnv.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return { processed: 0, sent: 0, failed: 0, campaignsTouched: [] };
  }

  const { data: recipients, error } = await admin
    .from('platform_outreach_recipients')
    .select('id, campaign_id, email, subject, body_text')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error || !recipients?.length) {
    return { processed: 0, sent: 0, failed: 0, campaignsTouched: [] };
  }

  const campaignIds = [...new Set(recipients.map((r) => r.campaign_id))];
  const { data: campaigns } = await admin
    .from('platform_outreach_campaigns')
    .select('id, status')
    .in('id', campaignIds);

  const activeCampaignIds = new Set(
    (campaigns ?? [])
      .filter((c) => c.status === 'queued' || c.status === 'sending')
      .map((c) => c.id),
  );

  const campaignIdsTouched = new Set<string>();
  let sent = 0;
  let failed = 0;
  let processed = 0;
  const origin = getPublicOrigin(null);

  for (const recipient of recipients) {
    if (!activeCampaignIds.has(recipient.campaign_id)) {
      continue;
    }

    processed += 1;
    campaignIdsTouched.add(recipient.campaign_id);

    await admin
      .from('platform_outreach_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', recipient.campaign_id)
      .in('status', ['queued', 'sending']);

    const token = createOutreachUnsubscribeToken({
      recipientId: recipient.id,
      email: recipient.email,
    });
    const unsubscribeUrl = `${origin}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
    const content = buildOutreachEmailContent({
      subject: recipient.subject,
      bodyText: recipient.body_text,
      unsubscribeUrl,
    });

    const result = await sendCampaignEmail({
      to: recipient.email,
      from,
      subject: content.subject,
      text: content.text,
      html: content.html,
      tags: [
        { name: 'outreach_campaign_id', value: recipient.campaign_id },
        { name: 'outreach_recipient_id', value: recipient.id },
      ],
    });

    const now = new Date().toISOString();
    if (result.ok) {
      sent += 1;
      await admin
        .from('platform_outreach_recipients')
        .update({
          status: 'sent',
          resend_email_id: result.emailId,
          sent_at: now,
          error_message: null,
          updated_at: now,
        })
        .eq('id', recipient.id);
    } else {
      failed += 1;
      await admin
        .from('platform_outreach_recipients')
        .update({
          status: 'failed',
          error_message: result.error.slice(0, 500),
          updated_at: now,
        })
        .eq('id', recipient.id);
    }
  }

  for (const campaignId of campaignIdsTouched) {
    await refreshOutreachCampaignMetrics(admin, campaignId);
    await finalizeOutreachCampaignIfDrained(admin, campaignId);
  }

  return {
    processed,
    sent,
    failed,
    campaignsTouched: [...campaignIdsTouched],
  };
}
