'use client';

/**
 * ThemeProvider - tracks the user's theme preference (system | light | dark)
 * and keeps the resolved theme synchronised with the OS when "system" is
 * selected.
 *
 * The pre-hydration script (themeScript.ts) handles the *initial* paint by
 * setting `data-theme` on <html> before React renders. This provider then
 * takes over for runtime updates (user toggles + OS-level changes).
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
import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './themeScript';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Important: initialise from `null` and hydrate inside an effect so the
  // server-rendered HTML and the first client render match exactly.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const initial = readInitialPreference();
    const initialResolved = resolve(initial);
    setPreferenceState(initial);
    setResolved(initialResolved);
    applyToDom(initial, initialResolved);
  }, []);

  // Watch OS color-scheme changes while the user is on `system`.
  useEffect(() => {
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
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
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
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
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
