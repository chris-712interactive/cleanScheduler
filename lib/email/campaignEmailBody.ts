import {
  applyCampaignMergeTags,
  htmlToPlainCampaignText,
  type CampaignMergeContext,
} from '@/lib/campaigns/campaignMergeTags';
import { getCampaignTemplateDefinition } from '@/lib/campaigns/campaignTemplateCatalog';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import { tenantEmailBrand } from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { sanitizeCampaignHtml } from '@/lib/email/sanitizeCampaignHtml';
import { emailButtonHtml, wrapTransactionalEmailHtml } from '@/lib/email/transactionalEmailLayout';

export interface CampaignEmailContentParams {
  tenantName: string;
  customerFirstName: string;
  customerLastName: string;
  customerFullName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  templateKey: CampaignTemplateKey;
  portalUrl: string;
  unsubscribeUrl: string;
  addressLine: string | null;
  brandColor: string;
  logoUrl: string | null;
  /** Pro white-label workspaces omit the Clean Scheduler footer line. */
  showPlatformMark?: boolean;
}

export interface CampaignPreviewBranding {
  tenantName: string;
  brandColor: string;
  addressLine: string | null;
  portalUrl: string;
  logoUrl: string | null;
  showPlatformMark?: boolean;
}

function mergeContextFromParams(params: CampaignEmailContentParams): CampaignMergeContext {
  return {
    first_name: params.customerFirstName,
    last_name: params.customerLastName,
    customer_name: params.customerFullName,
    tenant_name: params.tenantName,
    portal_url: params.portalUrl,
  };
}

function resolveBodyHtml(
  params: CampaignEmailContentParams,
  context: CampaignMergeContext,
): string {
  const template = getCampaignTemplateDefinition(params.templateKey);
  const rawHtml = params.bodyHtml.trim() || params.bodyText.trim() || template.defaultBodyHtml;
  const sanitized = sanitizeCampaignHtml(rawHtml);
  return applyCampaignMergeTags(sanitized, context);
}

function resolveBodyText(
  params: CampaignEmailContentParams,
  context: CampaignMergeContext,
): string {
  const template = getCampaignTemplateDefinition(params.templateKey);
  if (params.bodyText.trim()) {
    return applyCampaignMergeTags(params.bodyText.trim(), context);
  }
  if (params.bodyHtml.trim()) {
    return applyCampaignMergeTags(htmlToPlainCampaignText(params.bodyHtml), context);
  }
  return applyCampaignMergeTags(htmlToPlainCampaignText(template.defaultBodyHtml), context);
}

function assembleCampaignHtml(params: {
  subject: string;
  bodyHtml: string;
  tenantName: string;
  brandColor: string;
  logoUrl: string | null;
  addressLine: string | null;
  portalUrl: string;
  unsubscribeUrl: string;
  ctaLabel: string;
  accentLabel: string;
  showPlatformMark?: boolean;
}): string {
  const brand = tenantEmailBrand({
    name: params.tenantName,
    brandColor: params.brandColor,
    logoUrl: params.logoUrl,
    addressLine: params.addressLine,
    showPlatformMark: params.showPlatformMark,
  });

  return wrapTransactionalEmailHtml({
    brand,
    preheader: params.subject,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${escapeHtmlLite(brand.brandColor)};">${escapeHtmlLite(params.accentLabel)}</p>
      <div>${params.bodyHtml}</div>
      ${emailButtonHtml({ href: params.portalUrl, label: params.ctaLabel, color: brand.brandColor })}
    `.trim(),
    footerHtml: `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;"><a href="${escapeHtmlLite(params.unsubscribeUrl)}" style="color:#5c6f6e;text-decoration:underline;">Unsubscribe</a></p>`,
  });
}

export function buildCampaignEmailContent(params: CampaignEmailContentParams): {
  subject: string;
  text: string;
  html: string;
} {
  const context = mergeContextFromParams(params);
  const template = getCampaignTemplateDefinition(params.templateKey);
  const subject = applyCampaignMergeTags(params.subject.trim(), context);
  const bodyHtml = resolveBodyHtml(params, context);
  const bodyText = resolveBodyText(params, context);

  const html = assembleCampaignHtml({
    subject,
    bodyHtml,
    tenantName: params.tenantName,
    brandColor: params.brandColor,
    logoUrl: params.logoUrl,
    addressLine: params.addressLine,
    portalUrl: params.portalUrl,
    unsubscribeUrl: params.unsubscribeUrl,
    ctaLabel: template.ctaLabel,
    accentLabel: template.accentLabel,
    showPlatformMark: params.showPlatformMark,
  });

  const text = [
    bodyText,
    '',
    `${template.ctaLabel}: ${params.portalUrl}`,
    '',
    `${params.tenantName}${params.addressLine?.trim() ? `\n${params.addressLine.trim()}` : ''}`,
    '',
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ].join('\n');

  return { subject, text, html };
}

/** Client-safe preview using sample merge values (no unsubscribe footer in editor preview). */
export function buildCampaignEmailPreviewHtml(params: {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  templateKey: CampaignTemplateKey;
  branding: CampaignPreviewBranding;
  mergeContext: CampaignMergeContext;
}): { subject: string; html: string } {
  const template = getCampaignTemplateDefinition(params.templateKey);
  const subject = applyCampaignMergeTags(params.subject.trim(), params.mergeContext);
  const bodyHtml = resolveBodyHtml(
    {
      tenantName: params.branding.tenantName,
      customerFirstName: params.mergeContext.first_name,
      customerLastName: params.mergeContext.last_name,
      customerFullName: params.mergeContext.customer_name,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyHtml: params.bodyHtml,
      templateKey: params.templateKey,
      portalUrl: params.branding.portalUrl,
      unsubscribeUrl: '#',
      addressLine: params.branding.addressLine,
      brandColor: params.branding.brandColor,
      logoUrl: params.branding.logoUrl,
      showPlatformMark: params.branding.showPlatformMark,
    },
    params.mergeContext,
  );

  const html = assembleCampaignHtml({
    subject,
    bodyHtml,
    tenantName: params.branding.tenantName,
    brandColor: params.branding.brandColor,
    logoUrl: params.branding.logoUrl,
    addressLine: params.branding.addressLine,
    portalUrl: params.branding.portalUrl,
    unsubscribeUrl: '#',
    ctaLabel: template.ctaLabel,
    accentLabel: template.accentLabel,
    showPlatformMark: params.branding.showPlatformMark,
  });

  return { subject, html };
}

export function buildCampaignTemplatePreviewHtml(
  templateKey: CampaignTemplateKey,
  branding: CampaignPreviewBranding,
): string {
  const template = getCampaignTemplateDefinition(templateKey);
  return buildCampaignEmailPreviewHtml({
    subject: template.defaultSubject,
    bodyText: '',
    bodyHtml: template.defaultBodyHtml,
    templateKey,
    branding,
    mergeContext: {
      first_name: 'Jamie',
      last_name: 'Rivera',
      customer_name: 'Jamie Rivera',
      tenant_name: branding.tenantName,
      portal_url: branding.portalUrl,
    },
  }).html;
}
