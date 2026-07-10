import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { formatLegalBusinessAddress, PRODUCT_NAME } from '@/lib/legal/site';
import type { OutreachSignature } from '@/lib/admin/outreachSignature';

export interface BuildOutreachEmailContentParams {
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
  signature?: OutreachSignature | null;
}

function buildSignatureText(signature: OutreachSignature | null | undefined): string {
  if (!signature?.enabled) return '';
  const lines: string[] = ['', '—'];
  if (signature.name) lines.push(signature.name);
  if (signature.title || signature.company) {
    lines.push([signature.title, signature.company].filter(Boolean).join(', '));
  }
  if (signature.email) lines.push(signature.email);
  if (signature.phone) lines.push(signature.phone);
  if (signature.website) lines.push(signature.website);
  return lines.length > 2 ? lines.join('\n') : '';
}

function buildSignatureHtml(signature: OutreachSignature | null | undefined): string {
  if (!signature?.enabled) return '';

  const logo = signature.logoUrl
    ? `<p style="margin:0 0 12px;"><img src="${escapeHtmlLite(signature.logoUrl)}" alt="${escapeHtmlLite(signature.company || PRODUCT_NAME)}" width="140" style="display:block;max-height:48px;width:auto;height:auto;border:0;" /></p>`
    : '';

  const nameLine = signature.name
    ? `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtmlLite(signature.name)}</p>`
    : '';

  const titleCompany = [signature.title, signature.company].filter(Boolean).join(' · ');
  const titleLine = titleCompany
    ? `<p style="margin:0 0 10px;font-size:13px;color:#4b5563;line-height:1.4;">${escapeHtmlLite(titleCompany)}</p>`
    : '';

  const contactBits: string[] = [];
  if (signature.email) {
    contactBits.push(
      `<a href="mailto:${escapeHtmlLite(signature.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtmlLite(signature.email)}</a>`,
    );
  }
  if (signature.phone) {
    contactBits.push(
      `<a href="tel:${escapeHtmlLite(signature.phone.replace(/[^\d+]/g, ''))}" style="color:#4b5563;text-decoration:none;">${escapeHtmlLite(signature.phone)}</a>`,
    );
  }
  if (signature.website) {
    const href = signature.website.startsWith('http')
      ? signature.website
      : `https://${signature.website}`;
    contactBits.push(
      `<a href="${escapeHtmlLite(href)}" style="color:#2563eb;text-decoration:none;">${escapeHtmlLite(signature.website.replace(/^https?:\/\//i, ''))}</a>`,
    );
  }

  const contactLine = contactBits.length
    ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#4b5563;">${contactBits.join(' &nbsp;·&nbsp; ')}</p>`
    : '';

  if (!logo && !nameLine && !titleLine && !contactLine) return '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
  <tr>
    <td style="padding-top:20px;border-top:1px solid #e5e7eb;">
      ${logo}${nameLine}${titleLine}${contactLine}
    </td>
  </tr>
</table>`;
}

export function buildOutreachEmailContent(params: BuildOutreachEmailContentParams): {
  subject: string;
  text: string;
  html: string;
} {
  const address = formatLegalBusinessAddress();
  const body = params.bodyText.trim();
  const subject = params.subject.trim();
  const signatureText = buildSignatureText(params.signature);
  const signatureHtml = buildSignatureHtml(params.signature);

  const text = [
    body,
    signatureText,
    '',
    '---',
    `${PRODUCT_NAME} · ${address}`,
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeHtmlLite(block).replace(/\n/g, '<br />');
      return `<p style="margin:0 0 16px;line-height:1.6;color:#111827;font-size:15px;font-family:Georgia,'Times New Roman',serif;">${withBreaks}</p>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="height:4px;background:#0f766e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              ${paragraphs}
              ${signatureHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.5;color:#6b7280;">
              <p style="margin:0 0 6px;">${escapeHtmlLite(PRODUCT_NAME)} · ${escapeHtmlLite(address)}</p>
              <p style="margin:0;"><a href="${escapeHtmlLite(params.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
