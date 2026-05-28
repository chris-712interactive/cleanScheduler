import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';

const TEMPLATE_INTRO: Record<CampaignTemplateKey, string> = {
  promo: 'We wanted to share a special offer with you.',
  seasonal: 'Season is here — let us help keep your space spotless.',
  re_engagement: 'We have missed working with you and would love to schedule your next visit.',
  review_ask: 'Thank you for choosing us. We would appreciate your feedback.',
  service_reminder: 'Friendly reminder about upcoming service opportunities with our team.',
};

export interface CampaignEmailContentParams {
  tenantName: string;
  customerFirstName: string;
  subject: string;
  bodyText: string;
  templateKey: CampaignTemplateKey;
  portalUrl: string;
  unsubscribeUrl: string;
  addressLine: string | null;
  brandColor: string;
}

export function buildCampaignEmailContent(params: CampaignEmailContentParams): {
  subject: string;
  text: string;
  html: string;
} {
  const intro = params.bodyText.trim() || TEMPLATE_INTRO[params.templateKey];
  const greeting = `Hi ${params.customerFirstName},`;
  const footerAddress = params.addressLine?.trim() || '';
  const text = [
    greeting,
    '',
    intro,
    '',
    `Visit your customer portal: ${params.portalUrl}`,
    '',
    `${params.tenantName}${footerAddress ? `\n${footerAddress}` : ''}`,
    '',
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ].join('\n');

  const html = `
<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#111;">
  <p>${escapeHtmlLite(greeting)}</p>
  <p>${escapeHtmlLite(intro)}</p>
  <p style="margin:24px 0;">
    <a href="${escapeHtmlLite(params.portalUrl)}" style="display:inline-block;padding:10px 18px;background:${escapeHtmlLite(params.brandColor)};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
      Open customer portal
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="font-size:13px;color:#6b7280;margin:0;">
    <strong>${escapeHtmlLite(params.tenantName)}</strong><br />
    ${footerAddress ? `${escapeHtmlLite(footerAddress)}<br />` : ''}
    <a href="${escapeHtmlLite(params.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a>
  </p>
</div>`.trim();

  return {
    subject: params.subject.trim(),
    text,
    html,
  };
}
