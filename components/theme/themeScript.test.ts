import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_PREFERENCE,
  isLightOnlyPath,
  isMarketingHostname,
  parseThemePreference,
  themeScript,
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

  it('treats a nested admin host as marketing and the real admin host as a portal', () => {
    expect(isMarketingHostname('admin.lvh.me', 'lvh.me:3000')).toBe(false);
    expect(isMarketingHostname('admin.evil.lvh.me', 'lvh.me:3000')).toBe(true);
    expect(isMarketingHostname('acme.lvh.me', 'lvh.me:3000')).toBe(false);
    expect(themeScript).toContain("prefix.indexOf('.')");
  });

  it('treats start-trial and sign-in as light-only paths', () => {
    expect(isLightOnlyPath('/start-trial')).toBe(true);
    expect(isLightOnlyPath('/sign-in')).toBe(true);
    expect(isLightOnlyPath('/settings/business')).toBe(false);
    expect(isLightOnlyPath('/')).toBe(false);
  });
});
