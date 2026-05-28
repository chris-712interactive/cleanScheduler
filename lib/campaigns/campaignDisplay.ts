import type { StatusTone } from '@/components/ui/StatusPill';
import type {
  CampaignAudiencePreset,
  CampaignStatus,
  CampaignTemplateKey,
} from '@/lib/campaigns/types';

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function campaignStatusTone(status: CampaignStatus): StatusTone {
  if (status === 'sent') return 'success';
  if (status === 'sending') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export const CAMPAIGN_AUDIENCE_PRESET_LABEL: Record<CampaignAudiencePreset, string> = {
  all_marketable: 'All marketable customers',
  email_preferred: 'Email-preferred customers',
  residential: 'Residential customers',
  portal_nudge: 'No portal login yet',
  open_balance: 'Open invoice balance',
};

export const CAMPAIGN_TEMPLATE_LABEL: Record<CampaignTemplateKey, string> = {
  promo: 'Promotion',
  seasonal: 'Seasonal offer',
  re_engagement: 'Re-engagement',
  review_ask: 'Review request',
  service_reminder: 'Service reminder',
};

export function formatCampaignRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
