import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  isLightOnlyPath,
  parseThemePreference,
} from '@/components/theme/themeScript';

describe('themeScript helpers', () => {
  it('defaults missing preference to light (not system)', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('light');
    expect(parseThemePreference(null)).toBe('light');
    expect(parseThemePreference(undefined)).toBe('light');
    expect(parseThemePreference('')).toBe('light');
    expect(parseThemePreference('nope')).toBe('light');
  });

  it('preserves explicit stored preferences', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('treats start-trial and sign-in as light-only paths', () => {
    expect(isLightOnlyPath('/start-trial')).toBe(true);
    expect(isLightOnlyPath('/sign-in')).toBe(true);
    expect(isLightOnlyPath('/settings/business')).toBe(false);
    expect(isLightOnlyPath('/')).toBe(false);
  });
});
