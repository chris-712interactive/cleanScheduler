/**
 * Pre-hydration theme script.
 *
 * This string is rendered as an inline `<script>` in the document <head>
 * BEFORE React hydrates. It reads the saved preference from localStorage and
 * the OS color-scheme media query, then sets `data-theme` (resolved to
 * "light" | "dark") and `data-theme-pref` (raw preference) on <html>.
 *
 * Doing this before hydration prevents the dreaded "flash of wrong theme"
 * when a user with a stored "dark" preference loads a page whose server
 * default is light.
 */
export const THEME_STORAGE_KEY = 'cs_theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const themeScript = /* javascript */ `
(function () {
  try {
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

    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', pref);
  } catch (e) {
    // Non-fatal: render in light mode and let the provider self-correct.
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme-pref', 'system');
  }
})();
`;
