/**
 * Pre-hydration theme script.
 *
 * This string is rendered as an inline `<script>` in the document <head>
 * BEFORE React hydrates. It reads the saved preference from localStorage and
 * the OS color-scheme media query, then sets `data-theme` (resolved to
 * "light" | "dark") and `data-theme-pref` (raw preference) on <html>.
 *
 * Marketing hosts always render in light mode — no toggle, no system dark.
 *
 * Doing this before hydration prevents the dreaded "flash of wrong theme"
 * when a user with a stored "dark" preference loads a page whose server
 * default is light.
 */
export const THEME_STORAGE_KEY = 'cs_theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Mirrors middleware portal classification for the marketing site. */
const RESERVED_MARKETING_SUBDOMAINS = new Set([
  'api',
  'app',
  'auth',
  'static',
  'cdn',
  'assets',
  'mail',
  'support',
  'help',
  'docs',
  'blog',
  'status',
  'staging',
  'dev',
  'preview',
]);

export function marketingApexHost(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
}

export function isMarketingHostname(
  hostname: string,
  apexHost: string = marketingApexHost(),
): boolean {
  const apex = apexHost.split(':')[0]!.toLowerCase();
  const host = hostname.split(':')[0]!.toLowerCase();

  if (host === apex) return true;

  if (!host.endsWith(`.${apex}`)) {
    // Preview URLs and unknown hosts use the marketing route tree.
    return true;
  }

  const subdomain = host.slice(0, -(apex.length + 1)).split('.')[0] ?? '';
  if (!subdomain) return true;
  if (subdomain === 'www') return true;
  if (subdomain === 'admin' || subdomain === 'my') return false;
  if (RESERVED_MARKETING_SUBDOMAINS.has(subdomain)) return true;
  return false;
}

const MARKETING_APEX = marketingApexHost().split(':')[0]!.toLowerCase();
const MARKETING_RESERVED = JSON.stringify([...RESERVED_MARKETING_SUBDOMAINS]);

export const themeScript = /* javascript */ `
(function () {
  try {
    var root = document.documentElement;
    var host = window.location.hostname.toLowerCase();
    var apex = '${MARKETING_APEX}';
    var reserved = ${MARKETING_RESERVED};
    var isMarketing = true;
    var subdomain = '';

    if (host === apex) {
      isMarketing = true;
    } else if (!host.endsWith('.' + apex)) {
      isMarketing = true;
    } else {
      subdomain = host.slice(0, -(apex.length + 1)).split('.')[0] || '';
      if (!subdomain || subdomain === 'www') {
        isMarketing = true;
      } else if (subdomain === 'admin' || subdomain === 'my') {
        isMarketing = false;
      } else if (reserved.indexOf(subdomain) >= 0) {
        isMarketing = true;
      } else {
        isMarketing = false;
      }
    }

    if (isMarketing) {
      root.setAttribute('data-theme', 'light');
      root.setAttribute('data-theme-pref', 'light');
      root.setAttribute('data-marketing-theme', 'locked');
      return;
    }

    var KEY = '${THEME_STORAGE_KEY}';
    var pref = localStorage.getItem(KEY);
    if (pref !== 'light' && pref !== 'dark' && pref !== 'system') {
      pref = 'system';
    }

    var resolved = pref;
    if (pref === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', pref);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme-pref', 'system');
  }
})();
`;
