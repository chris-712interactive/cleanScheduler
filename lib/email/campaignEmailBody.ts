import {
  applyCampaignMergeTags,
  htmlToPlainCampaignText,
  type CampaignMergeContext,
} from '@/lib/campaigns/campaignMergeTags';
import { getCampaignTemplateDefinition } from '@/lib/campaigns/campaignTemplateCatalog';
import type { CampaignTemplateKey } from '@/lib/campaigns/types';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { sanitizeCampaignHtml } from '@/lib/email/sanitizeCampaignHtml';

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
}

export interface CampaignPreviewBranding {
  tenantName: string;
  brandColor: string;
  addressLine: string | null;
  portalUrl: string;
  logoUrl: string | null;
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

function buildInnerBodyHtml(params: {
  bodyHtml: string;
  templateKey: CampaignTemplateKey;
  brandColor: string;
  logoUrl: string | null;
  tenantName: string;
  portalUrl: string;
  ctaLabel: string;
  accentLabel: string;
}): string {
  const logoBlock = params.logoUrl
    ? `<p style="margin:0 0 16px;"><img src="${escapeHtmlLite(params.logoUrl)}" alt="${escapeHtmlLite(params.tenantName)}" style="max-height:48px;width:auto;" /></p>`
    : `<p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${escapeHtmlLite(params.brandColor)};">${escapeHtmlLite(params.accentLabel)}</p>`;

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111827;">
  ${logoBlock}
  <div>${params.bodyHtml}</div>
  <p style="margin:28px 0 0;">
    <a href="${escapeHtmlLite(params.portalUrl)}" style="display:inline-block;padding:12px 20px;background:${escapeHtmlLite(params.brandColor)};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
      ${escapeHtmlLite(params.ctaLabel)}
    </a>
  </p>
</div>`.trim();
}

function buildFooterHtml(params: {
  tenantName: string;
  addressLine: string | null;
  unsubscribeUrl: string;
}): string {
  const footerAddress = params.addressLine?.trim() || '';
  return `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
<p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5;">
  <strong>${escapeHtmlLite(params.tenantName)}</strong><br />
  ${footerAddress ? `${escapeHtmlLite(footerAddress)}<br />` : ''}
  <a href="${escapeHtmlLite(params.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a>
</p>`.trim();
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

  const innerHtml = buildInnerBodyHtml({
    bodyHtml,
    templateKey: params.templateKey,
    brandColor: params.brandColor,
    logoUrl: params.logoUrl,
    tenantName: params.tenantName,
    portalUrl: params.portalUrl,
    ctaLabel: template.ctaLabel,
    accentLabel: template.accentLabel,
  });

  const html = `${innerHtml}${buildFooterHtml({
    tenantName: params.tenantName,
    addressLine: params.addressLine,
    unsubscribeUrl: params.unsubscribeUrl,
  })}`;

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
    },
    params.mergeContext,
  );

  const innerHtml = buildInnerBodyHtml({
    bodyHtml,
    templateKey: params.templateKey,
    brandColor: params.branding.brandColor,
    logoUrl: params.branding.logoUrl,
    tenantName: params.branding.tenantName,
    portalUrl: params.branding.portalUrl,
    ctaLabel: template.ctaLabel,
    accentLabel: template.accentLabel,
  });

  const html = `${innerHtml}${buildFooterHtml({
    tenantName: params.branding.tenantName,
    addressLine: params.branding.addressLine,
    unsubscribeUrl: '#',
  })}`;

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
