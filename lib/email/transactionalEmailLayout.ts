import {
  emailBrandAccent,
  emailBrandName,
  PLATFORM_EMAIL_BRAND_COLOR,
  PLATFORM_EMAIL_LOGO_URL,
  platformEmailBrand,
  safeEmailBrandColor,
  type EmailBrand,
} from '@/lib/email/emailBrand';
import { escapeHtmlLite } from '@/lib/email/escapeHtml';
import { formatLegalBusinessAddress, PRODUCT_NAME } from '@/lib/legal/site';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeEmailAttr(value: string): string {
  return escapeHtmlLite(value).replace(/'/g, '&#39;');
}

/** White label on dark brand colors, ink on pale ones. */
export function emailButtonTextColor(hex: string): string {
  const color = hex.startsWith('#') ? hex : `#${hex}`;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return '#ffffff';
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? '#102122' : '#ffffff';
}

export function safeEmailHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('#') && !value.includes('"') && !value.includes("'")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function emailButtonHtml(params: { href: string; label: string; color?: string }): string {
  const href = safeEmailHref(params.href);
  const label = escapeHtmlLite(params.label);
  if (!href) return `<p style="margin:0 0 16px;font-weight:600;">${label}</p>`;
  const color = params.color ? safeEmailBrandColor(params.color) : PLATFORM_EMAIL_BRAND_COLOR;
  const text = emailButtonTextColor(color);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
  <tr>
    <td align="center" bgcolor="${color}" style="border-radius:8px;background:${color};">
      <a href="${escapeEmailAttr(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:${text};text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function emailFactsHtml(rows: Array<{ label: string; value: string }>): string {
  if (rows.length === 0) return '';
  const body = rows
    .map((row, index) => {
      const border = index === rows.length - 1 ? '' : 'border-bottom:1px solid #e3eeec;';
      return `<tr>
        <td style="padding:11px 14px;${border}font-size:13px;line-height:1.4;color:#5c6f6e;width:38%;vertical-align:top;">${escapeHtmlLite(row.label)}</td>
        <td style="padding:11px 14px;${border}font-size:14px;line-height:1.4;font-weight:600;color:#102122;vertical-align:top;">${escapeHtmlLite(row.value)}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid #e3eeec;border-radius:10px;border-collapse:separate;">${body}</table>`;
}

function headerHtml(brand: EmailBrand, accent: string): string {
  if (brand.kind === 'platform') {
    return `<table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${escapeEmailAttr(PLATFORM_EMAIL_LOGO_URL)}" alt="" width="40" height="40" style="display:block;border:0;width:40px;height:40px;" />
        </td>
        <td style="vertical-align:middle;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${accent};line-height:1.2;">
          ${escapeHtmlLite(PRODUCT_NAME)}
        </td>
      </tr>
    </table>`;
  }

  const name = escapeHtmlLite(brand.name);
  const logo = brand.logoUrl
    ? `<img src="${escapeEmailAttr(brand.logoUrl)}" alt="${name}" height="48" style="display:block;border:0;height:48px;width:auto;max-width:220px;margin:0 0 12px;" />`
    : '';
  return `${logo}<div style="font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${accent};line-height:1.25;">${name}</div>`;
}

function footerInnerHtml(brand: EmailBrand, extraHtml?: string): string {
  if (brand.kind === 'platform') {
    return `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;font-weight:700;color:#102122;">${escapeHtmlLite(PRODUCT_NAME)}</p>
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#5c6f6e;">${escapeHtmlLite(formatLegalBusinessAddress())}</p>
      <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#6b7c7b;">You are receiving this because of your ${escapeHtmlLite(PRODUCT_NAME)} account or a request you made.</p>
      ${extraHtml ?? ''}`;
  }

  const contact = [brand.phone, brand.email]
    .filter(Boolean)
    .map((part) => escapeHtmlLite(part!))
    .join(' · ');
  const platformLine = brand.showPlatformMark
    ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:#8aa09e;">Sent with ${escapeHtmlLite(PRODUCT_NAME)}</p>`
    : '';

  return `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;font-weight:700;color:#102122;">${escapeHtmlLite(brand.name)}</p>
    ${brand.addressLine ? `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#5c6f6e;">${escapeHtmlLite(brand.addressLine)}</p>` : ''}
    ${contact ? `<p style="margin:4px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#5c6f6e;">${contact}</p>` : ''}
    <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#6b7c7b;">This message was sent by ${escapeHtmlLite(brand.name)}.</p>
    ${platformLine}
    ${extraHtml ?? ''}`;
}

export function wrapTransactionalEmailHtml(params: {
  preheader?: string;
  bodyHtml: string;
  brand?: EmailBrand;
  /** Extra footer markup, already escaped by the caller (unsubscribe, and similar). */
  footerHtml?: string;
}): string {
  const brand = params.brand ?? platformEmailBrand();
  const accent = emailBrandAccent(brand);
  const name = emailBrandName(brand);
  const preheader = params.preheader?.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtmlLite(name)}</title>
  <style>
    .cs-email p { margin: 0 0 16px; }
    .cs-email ul { margin: 0 0 16px; padding-left: 20px; }
    .cs-email li { margin: 0 0 6px; }
    .cs-email a { color: ${accent}; }
  </style>
</head>
<body style="margin:0;padding:0;background:#e7f0ef;">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#e7f0ef;">${escapeHtmlLite(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7f0ef;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #d7e4e2;border-radius:16px;overflow:hidden;">
          <tr>
            <td bgcolor="${accent}" style="background:${accent};height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;">
              ${headerHtml(brand, accent)}
            </td>
          </tr>
          <tr>
            <td class="cs-email" style="padding:20px 36px 32px;font-family:${FONT};font-size:16px;line-height:1.6;color:#1a2e2c;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 22px;background:#f4f8f7;border-top:1px solid #e3eeec;">
              ${footerInnerHtml(brand, params.footerHtml)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
