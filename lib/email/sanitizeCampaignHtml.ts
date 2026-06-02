const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'img',
  'span',
  'div',
]);

const GLOBAL_STRIP_RE =
  /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[^>]*\/?>/gi;

function isSafeUrl(url: string, allowMailto: boolean): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false;
  if (allowMailto && lower.startsWith('mailto:')) return true;
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function sanitizeAttributes(tag: string, attrs: string): string {
  if (tag === 'a') {
    const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? '';
    if (!isSafeUrl(href, true)) return '';
    return ` href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer"`;
  }

  if (tag === 'img') {
    const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const altMatch = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = srcMatch?.[2] ?? srcMatch?.[3] ?? srcMatch?.[4] ?? '';
    if (!isSafeUrl(src, false)) return '';
    const alt = (altMatch?.[2] ?? altMatch?.[3] ?? altMatch?.[4] ?? '').replace(/"/g, '&quot;');
    return ` src="${src.replace(/"/g, '&quot;')}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;"`;
  }

  return '';
}

/** Allowlist sanitizer for tenant-authored campaign HTML. */
export function sanitizeCampaignHtml(raw: string): string {
  const withoutDangerous = raw.replace(GLOBAL_STRIP_RE, '');
  return withoutDangerous.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    (full, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (full.startsWith('</')) return `</${tag}>`;
      if (tag === 'br' || tag === 'img') {
        const safeAttrs = sanitizeAttributes(tag, attrs);
        if (tag === 'img' && !safeAttrs) return '';
        return `<${tag}${safeAttrs}>`;
      }
      const safeAttrs = sanitizeAttributes(tag, attrs);
      return `<${tag}${safeAttrs}>`;
    },
  );
}
