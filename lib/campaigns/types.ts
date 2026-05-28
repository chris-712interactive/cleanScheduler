export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled';

export type CampaignAudiencePreset =
  | 'all_marketable'
  | 'email_preferred'
  | 'residential'
  | 'portal_nudge'
  | 'open_balance';

export type CampaignTemplateKey =
  | 'promo'
  | 'seasonal'
  | 're_engagement'
  | 'review_ask'
  | 'service_reminder';

export type CampaignRecipientStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'skipped';

export interface CampaignAudienceMember {
  customerId: string;
  email: string;
  firstName: string;
}
