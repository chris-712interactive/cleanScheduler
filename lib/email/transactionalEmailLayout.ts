import { PRODUCT_NAME } from '@/lib/legal/site';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeEmailAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function wrapTransactionalEmailHtml(params: {
  preheader?: string;
  bodyHtml: string;
}): string {
  const preheader = params.preheader?.trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${PRODUCT_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#18181b;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #e4e4e7;font-size:14px;font-weight:600;color:#18181b;">
              ${PRODUCT_NAME}
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.5;color:#3f3f46;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;">
              Sent by ${PRODUCT_NAME} on behalf of your service provider.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
