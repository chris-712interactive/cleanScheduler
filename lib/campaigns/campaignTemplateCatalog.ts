import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import { campaignMergeTagToken } from '@/lib/campaigns/campaignMergeTags';

export interface CampaignTemplateDefinition {
  key: CampaignTemplateKey;
  description: string;
  accentLabel: string;
  ctaLabel: string;
  defaultSubject: string;
  defaultBodyHtml: string;
}

export const CAMPAIGN_TEMPLATE_CATALOG: Record<CampaignTemplateKey, CampaignTemplateDefinition> = {
  promo: {
    key: 'promo',
    description: 'Lead with a limited-time discount or special offer.',
    accentLabel: 'Special offer',
    ctaLabel: 'View offer',
    defaultSubject: `A special offer from ${campaignMergeTagToken('tenant_name')}`,
    defaultBodyHtml: `<p>Hi ${campaignMergeTagToken('first_name')},</p>
<p>We wanted to share a special offer with you. For a limited time, save on your next service with us.</p>
<p><strong>Book through your customer portal to claim this offer.</strong></p>`,
  },
  seasonal: {
    key: 'seasonal',
    description: 'Seasonal messaging for spring cleaning, holidays, and more.',
    accentLabel: 'Seasonal service',
    ctaLabel: 'Schedule seasonal clean',
    defaultSubject: `${campaignMergeTagToken('tenant_name')} — seasonal cleaning is here`,
    defaultBodyHtml: `<p>Hi ${campaignMergeTagToken('first_name')},</p>
<p>Season is here — let us help keep your space spotless. Our team is booking seasonal visits now.</p>
<p>Reserve your preferred date in the customer portal before slots fill up.</p>`,
  },
  re_engagement: {
    key: 're_engagement',
    description: 'Win back customers who have not booked recently.',
    accentLabel: 'We miss you',
    ctaLabel: 'Book a visit',
    defaultSubject: `${campaignMergeTagToken('tenant_name')} would love to see you again`,
    defaultBodyHtml: `<p>Hi ${campaignMergeTagToken('first_name')},</p>
<p>We have missed working with you and would love to schedule your next visit.</p>
<p>It only takes a minute to pick a time that works for you.</p>`,
  },
  review_ask: {
    key: 'review_ask',
    description: 'Ask happy customers for a review after a great visit.',
    accentLabel: 'Thank you',
    ctaLabel: 'Leave feedback',
    defaultSubject: `How did we do, ${campaignMergeTagToken('first_name')}?`,
    defaultBodyHtml: `<p>Hi ${campaignMergeTagToken('first_name')},</p>
<p>Thank you for choosing ${campaignMergeTagToken('tenant_name')}. If you had a great experience, we would really appreciate your feedback.</p>
<p>Your review helps other customers find reliable cleaning service.</p>`,
  },
  service_reminder: {
    key: 'service_reminder',
    description: 'Remind customers about upcoming or overdue service.',
    accentLabel: 'Friendly reminder',
    ctaLabel: 'Schedule now',
    defaultSubject: `Reminder from ${campaignMergeTagToken('tenant_name')}`,
    defaultBodyHtml: `<p>Hi ${campaignMergeTagToken('first_name')},</p>
<p>Friendly reminder about upcoming service opportunities with our team.</p>
<p>Visit your portal to confirm, reschedule, or book your next visit.</p>`,
  },
};

export function getCampaignTemplateDefinition(
  key: CampaignTemplateKey,
): CampaignTemplateDefinition {
  return CAMPAIGN_TEMPLATE_CATALOG[key];
}
