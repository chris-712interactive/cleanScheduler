import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

export async function refreshOutreachCampaignMetrics(
  admin: AdminClient,
  campaignId: string,
): Promise<void> {
  const { data: recipients } = await admin
    .from('platform_outreach_recipients')
    .select('status, delivered_at, opened_at, clicked_at, bounced_at, response_status')
    .eq('campaign_id', campaignId);

  const rows = recipients ?? [];
  const repliedStatuses = new Set(['replied', 'interested', 'not_interested', 'do_not_contact']);

  await admin
    .from('platform_outreach_campaigns')
    .update({
      recipient_count: rows.length,
      sent_count: rows.filter(
        (r) => r.status === 'sent' || r.status === 'delivered' || r.delivered_at,
      ).length,
      delivered_count: rows.filter((r) => r.status === 'delivered' || r.delivered_at).length,
      opened_count: rows.filter((r) => r.opened_at).length,
      clicked_count: rows.filter((r) => r.clicked_at).length,
      bounced_count: rows.filter((r) => r.status === 'bounced' || r.bounced_at).length,
      replied_count: rows.filter((r) => repliedStatuses.has(r.response_status)).length,
      skipped_count: rows.filter((r) => r.status === 'skipped').length,
      failed_count: rows.filter((r) => r.status === 'failed').length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}

export async function finalizeOutreachCampaignIfDrained(
  admin: AdminClient,
  campaignId: string,
): Promise<void> {
  const { count: remaining } = await admin
    .from('platform_outreach_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  if ((remaining ?? 0) > 0) return;

  const { data: campaign } = await admin
    .from('platform_outreach_campaigns')
    .select('status')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign || campaign.status === 'cancelled' || campaign.status === 'draft') return;

  await refreshOutreachCampaignMetrics(admin, campaignId);
  await admin
    .from('platform_outreach_campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .in('status', ['queued', 'sending']);
}
