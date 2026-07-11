import type { StatusTone } from '@/components/ui/StatusPill';
import type {
  OutreachCampaignStatus,
  OutreachRecipientStatus,
  OutreachResponseStatus,
} from '@/lib/admin/outreachTypes';

export const OUTREACH_CAMPAIGN_STATUS_LABEL: Record<OutreachCampaignStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export function outreachCampaignStatusTone(status: string): StatusTone {
  if (status === 'sent') return 'success';
  if (status === 'queued' || status === 'sending') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export const OUTREACH_RECIPIENT_STATUS_LABEL: Record<OutreachRecipientStatus, string> = {
  pending: 'Pending',
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  bounced: 'Bounced',
  failed: 'Failed',
  skipped: 'Skipped',
};

export function outreachRecipientStatusTone(status: string): StatusTone {
  if (status === 'delivered') return 'success';
  if (status === 'sent') return 'warning';
  if (status === 'bounced' || status === 'failed') return 'danger';
  if (status === 'queued' || status === 'pending') return 'info';
  if (status === 'skipped') return 'neutral';
  return 'neutral';
}

export const OUTREACH_RESPONSE_STATUS_LABEL: Record<OutreachResponseStatus, string> = {
  none: 'No response',
  replied: 'Replied',
  interested: 'Interested',
  not_interested: 'Not interested',
  do_not_contact: 'Do not contact',
};

export function formatOutreachRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
