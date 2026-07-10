import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshOutreachCampaignMetrics } from '@/lib/admin/outreachMetrics';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';
import type { Database } from '@/lib/supabase/database.types';

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: { name: string; value: string }[] | Record<string, string>;
  };
};

async function refreshCampaignMetrics(
  admin: SupabaseClient<Database>,
  campaignId: string,
): Promise<void> {
  const { data: recipients } = await admin
    .from('tenant_email_campaign_recipients')
    .select('status, delivered_at, opened_at, clicked_at, bounced_at')
    .eq('campaign_id', campaignId);

  const rows = recipients ?? [];
  await admin
    .from('tenant_email_campaigns')
    .update({
      sent_count: rows.filter(
        (r) =>
          r.status === 'sent' ||
          r.status === 'delivered' ||
          r.status === 'bounced' ||
          Boolean(r.bounced_at),
      ).length,
      delivered_count: rows.filter(
        (r) =>
          r.status !== 'bounced' &&
          !r.bounced_at &&
          (r.status === 'delivered' || Boolean(r.delivered_at)),
      ).length,
      opened_count: rows.filter((r) => r.opened_at).length,
      clicked_count: rows.filter((r) => r.clicked_at).length,
      bounced_count: rows.filter((r) => r.status === 'bounced' || r.bounced_at).length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}

async function handleOutreachWebhookEvent(
  admin: SupabaseClient<Database>,
  payload: ResendWebhookPayload,
  emailId: string,
  eventType: string,
): Promise<boolean> {
  const { data: recipient } = await admin
    .from('platform_outreach_recipients')
    .select('id, campaign_id, email_normalized, opened_at, clicked_at, status, bounced_at')
    .eq('resend_email_id', emailId)
    .maybeSingle();

  if (!recipient) return false;

  const now = new Date().toISOString();
  const updates: Database['public']['Tables']['platform_outreach_recipients']['Update'] = {};
  const alreadyBounced = recipient.status === 'bounced' || Boolean(recipient.bounced_at);

  if (eventType === 'email.delivered') {
    if (alreadyBounced) return true;
    updates.status = 'delivered';
    updates.delivered_at = now;
  } else if (eventType === 'email.opened') {
    if (!recipient.opened_at) updates.opened_at = now;
  } else if (eventType === 'email.clicked') {
    if (!recipient.clicked_at) updates.clicked_at = now;
  } else if (eventType === 'email.bounced') {
    updates.status = 'bounced';
    updates.bounced_at = now;
    updates.delivered_at = null;
    await admin.from('platform_outreach_suppressions').upsert(
      {
        email_normalized: normalizeOutreachEmail(recipient.email_normalized),
        reason: 'bounce',
        source: 'webhook',
        campaign_id: recipient.campaign_id,
      },
      { onConflict: 'email_normalized' },
    );
  } else {
    return true;
  }

  if (Object.keys(updates).length > 0) {
    await admin.from('platform_outreach_recipients').update(updates).eq('id', recipient.id);
  }

  await refreshOutreachCampaignMetrics(admin, recipient.campaign_id);
  return true;
}

export async function handleResendWebhookEvent(
  admin: SupabaseClient<Database>,
  payload: ResendWebhookPayload,
): Promise<void> {
  const eventType = payload.type ?? '';
  const emailId = payload.data?.email_id;
  if (!emailId) return;

  const { data: recipient } = await admin
    .from('tenant_email_campaign_recipients')
    .select('id, campaign_id, tenant_id, email, opened_at, clicked_at, status, bounced_at')
    .eq('resend_email_id', emailId)
    .maybeSingle();

  if (!recipient) {
    await handleOutreachWebhookEvent(admin, payload, emailId, eventType);
    return;
  }

  const now = new Date().toISOString();
  const updates: Database['public']['Tables']['tenant_email_campaign_recipients']['Update'] = {};
  const alreadyBounced = recipient.status === 'bounced' || Boolean(recipient.bounced_at);

  if (eventType === 'email.delivered') {
    if (alreadyBounced) return;
    updates.status = 'delivered';
    updates.delivered_at = now;
  } else if (eventType === 'email.opened') {
    if (!recipient.opened_at) updates.opened_at = now;
  } else if (eventType === 'email.clicked') {
    if (!recipient.clicked_at) updates.clicked_at = now;
  } else if (eventType === 'email.bounced') {
    updates.status = 'bounced';
    updates.bounced_at = now;
    updates.delivered_at = null;
    await admin.from('tenant_email_suppressions').upsert(
      {
        tenant_id: recipient.tenant_id,
        email_normalized: recipient.email.toLowerCase(),
        reason: 'bounce',
        source: 'webhook',
        campaign_id: recipient.campaign_id,
      },
      { onConflict: 'tenant_id,email_normalized' },
    );
  } else {
    return;
  }

  if (Object.keys(updates).length > 0) {
    await admin.from('tenant_email_campaign_recipients').update(updates).eq('id', recipient.id);
  }

  await refreshCampaignMetrics(admin, recipient.campaign_id);
}

export type { ResendWebhookPayload };
