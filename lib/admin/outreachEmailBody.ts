import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { formatLegalBusinessAddress, PRODUCT_NAME } from '@/lib/legal/site';

export function buildOutreachEmailContent(params: {
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const address = formatLegalBusinessAddress();
  const body = params.bodyText.trim();
  const subject = params.subject.trim();

  const text = [
    body,
    '',
    '---',
    `${PRODUCT_NAME} · ${address}`,
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ].join('\n');

  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeHtmlLite(block).replace(/\n/g, '<br />');
      return `<p style="margin:0 0 16px;line-height:1.55;color:#1a1a1a;font-size:15px;">${withBreaks}</p>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:28px 24px;">
          <tr><td>${paragraphs}</td></tr>
          <tr>
            <td style="padding-top:24px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#71717a;">
              <p style="margin:0 0 8px;">${escapeHtmlLite(PRODUCT_NAME)} · ${escapeHtmlLite(address)}</p>
              <p style="margin:0;"><a href="${escapeHtmlLite(params.unsubscribeUrl)}" style="color:#71717a;">Unsubscribe</a></p>
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
