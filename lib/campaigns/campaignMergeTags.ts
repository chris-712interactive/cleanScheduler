/** Merge tags available in campaign subject and body. Resolved per recipient at send time. */
export const CAMPAIGN_MERGE_TAG_KEYS = [
  'first_name',
  'last_name',
  'customer_name',
  'tenant_name',
  'portal_url',
] as const;

export type CampaignMergeTagKey = (typeof CAMPAIGN_MERGE_TAG_KEYS)[number];

export const CAMPAIGN_MERGE_TAG_LABEL: Record<CampaignMergeTagKey, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  customer_name: 'Full name',
  tenant_name: 'Business name',
  portal_url: 'Customer portal link',
};

export interface CampaignMergeContext {
  first_name: string;
  last_name: string;
  customer_name: string;
  tenant_name: string;
  portal_url: string;
}

export const CAMPAIGN_PREVIEW_MERGE_CONTEXT: CampaignMergeContext = {
  first_name: 'Jamie',
  last_name: 'Rivera',
  customer_name: 'Jamie Rivera',
  tenant_name: 'Sample Cleaning Co.',
  portal_url: 'https://portal.example.com',
};

const MERGE_TAG_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function campaignMergeTagToken(key: CampaignMergeTagKey): string {
  return `{{${key}}}`;
}

export function applyCampaignMergeTags(content: string, context: CampaignMergeContext): string {
  return content.replace(MERGE_TAG_RE, (_match, rawKey: string) => {
    const key = rawKey.trim() as CampaignMergeTagKey;
    if (key in context) {
      return context[key];
    }
    return '';
  });
}

export function htmlToPlainCampaignText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
