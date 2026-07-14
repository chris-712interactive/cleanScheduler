export type OutreachCampaignStatus =
  'draft' | 'queued' | 'sending' | 'sent' | 'cancelled' | 'failed';

export type OutreachRecipientStatus =
  'pending' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'skipped';

export type OutreachResponseStatus =
  'none' | 'replied' | 'interested' | 'not_interested' | 'do_not_contact';

export const OUTREACH_RESPONSE_STATUSES: OutreachResponseStatus[] = [
  'none',
  'replied',
  'interested',
  'not_interested',
  'do_not_contact',
];

export const OUTREACH_SEND_BATCH_SIZE = 40;

export function normalizeOutreachEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidOutreachEmail(email: string): boolean {
  const value = email.trim();
  if (!value || value.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
