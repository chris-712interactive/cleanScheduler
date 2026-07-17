'use client';

/**
 * ThemeProvider - tracks the user's theme preference (system | light | dark)
 * and keeps the resolved theme synchronised with the OS when "system" is
 * selected.
 *
 * Marketing hosts and auth/signup paths always stay in light mode; user
 * preference is restored on tenant, admin, and customer portals.
 *
 * The pre-hydration script (themeScript.ts) handles the *initial* paint by
 * setting `data-theme` on <html> before React renders. This provider then
 * takes over for runtime updates (user toggles + OS-level changes + leaving
 * light-locked routes via client navigation).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  isLightOnlyPath,
  isMarketingHostname,
  parseThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './themeScript';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  marketingThemeLocked: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME_PREFERENCE;
  return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyToDom(preference: ThemePreference, resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-pref', preference);
}

function applyMarketingLightTheme() {
  applyToDom('light', 'light');
  document.documentElement.setAttribute('data-marketing-theme', 'locked');
}

function clearMarketingLightTheme() {
  document.documentElement.removeAttribute('data-marketing-theme');
}

function shouldLockLightTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return isMarketingHostname(window.location.hostname) || isLightOnlyPath(window.location.pathname);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [marketingThemeLocked, setMarketingThemeLocked] = useState(() =>
    typeof window === 'undefined' ? false : shouldLockLightTheme(),
  );
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  useEffect(() => {
    if (shouldLockLightTheme()) {
      applyMarketingLightTheme();
      setMarketingThemeLocked(true);
      setPreferenceState('light');
      setResolved('light');
      return;
    }

    clearMarketingLightTheme();
    setMarketingThemeLocked(false);
    const stored = readStoredPreference();
    const nextResolved = resolve(stored);
    setPreferenceState(stored);
    setResolved(nextResolved);
    applyToDom(stored, nextResolved);
  }, [pathname]);

  useEffect(() => {
    if (marketingThemeLocked) return;
    if (preference !== 'system') return;
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolved(next);
      applyToDom('system', next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference, marketingThemeLocked]);

  const setPreference = useCallback((next: ThemePreference) => {
    if (shouldLockLightTheme()) return;

    const nextResolved = resolve(next);
    setPreferenceState(next);
    setResolved(nextResolved);
    applyToDom(next, nextResolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private mode / quota); ignore.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, marketingThemeLocked }),
    [preference, resolved, setPreference, marketingThemeLocked],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be called inside <ThemeProvider>.');
  }
  return ctx;
}
