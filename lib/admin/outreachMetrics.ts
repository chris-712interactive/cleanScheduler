import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

type OutreachMetricRow = {
  status: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  response_status: string;
};

function isBounced(row: Pick<OutreachMetricRow, 'status' | 'bounced_at'>): boolean {
  return row.status === 'bounced' || Boolean(row.bounced_at);
}

/** Exported for unit tests — bounce is attempted send, not a successful delivery. */
export function computeOutreachCampaignMetricCounts(rows: OutreachMetricRow[]): {
  recipient_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  replied_count: number;
  skipped_count: number;
  failed_count: number;
} {
  const repliedStatuses = new Set(['replied', 'interested', 'not_interested', 'do_not_contact']);

  return {
    recipient_count: rows.length,
    // Accepted by Resend (or later engagement) — includes bounces as attempted sends.
    sent_count: rows.filter(
      (r) =>
        r.status === 'sent' ||
        r.status === 'delivered' ||
        r.status === 'bounced' ||
        Boolean(r.delivered_at) ||
        Boolean(r.bounced_at),
    ).length,
    // Successful inbox delivery only — never count bounces as delivered.
    delivered_count: rows.filter(
      (r) => !isBounced(r) && (r.status === 'delivered' || Boolean(r.delivered_at)),
    ).length,
    opened_count: rows.filter((r) => r.opened_at).length,
    clicked_count: rows.filter((r) => r.clicked_at).length,
    bounced_count: rows.filter((r) => isBounced(r)).length,
    replied_count: rows.filter((r) => repliedStatuses.has(r.response_status)).length,
    skipped_count: rows.filter((r) => r.status === 'skipped').length,
    failed_count: rows.filter((r) => r.status === 'failed').length,
  };
}

export async function refreshOutreachCampaignMetrics(
  admin: AdminClient,
  campaignId: string,
): Promise<void> {
  const { data: recipients } = await admin
    .from('platform_outreach_recipients')
    .select('status, delivered_at, opened_at, clicked_at, bounced_at, response_status')
    .eq('campaign_id', campaignId);

  const counts = computeOutreachCampaignMetricCounts(recipients ?? []);

  await admin
    .from('platform_outreach_campaigns')
    .update({
      ...counts,
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
