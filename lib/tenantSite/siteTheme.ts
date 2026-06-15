import type { CSSProperties } from 'react';
import { DEFAULT_BRAND_COLOR } from '@/lib/tenant/tenantBusinessSettings';

export const TENANT_SITE_TEMPLATES = ['classic', 'modern', 'editorial'] as const;
export type TenantSiteTemplate = (typeof TENANT_SITE_TEMPLATES)[number];

export const TENANT_SITE_COLOR_SCHEMES = [
  'brand',
  'ocean',
  'forest',
  'slate',
  'sunset',
  'plum',
] as const;
export type TenantSiteColorScheme = (typeof TENANT_SITE_COLOR_SCHEMES)[number];

export type TenantSiteTemplateOption = {
  id: TenantSiteTemplate;
  label: string;
  description: string;
};

export type TenantSiteColorSchemeOption = {
  id: TenantSiteColorScheme;
  label: string;
  description: string;
  /** Preview swatch when not using tenant brand color */
  accent: string;
};

export const TENANT_SITE_TEMPLATE_OPTIONS: TenantSiteTemplateOption[] = [
  {
    id: 'classic',
    label: 'Classic',
    description:
      'Centered hero, card grid, and a balanced layout that works for any cleaning brand.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description:
      'Split hero with a trust panel, alternating sections, and a sharper visual rhythm.',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Typography-led layout with generous whitespace and refined section accents.',
  },
];

const PRESET_ACCENTS: Record<Exclude<TenantSiteColorScheme, 'brand'>, string> = {
  ocean: '#0284c7',
  forest: '#059669',
  slate: '#334155',
  sunset: '#c2410c',
  plum: '#7c3aed',
};

export const TENANT_SITE_COLOR_SCHEME_OPTIONS: TenantSiteColorSchemeOption[] = [
  {
    id: 'brand',
    label: 'Your brand color',
    description: 'Uses the accent color from Business settings.',
    accent: DEFAULT_BRAND_COLOR,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Fresh blue tones for a clean, professional feel.',
    accent: PRESET_ACCENTS.ocean,
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Natural greens suited to eco-friendly or residential brands.',
    accent: PRESET_ACCENTS.forest,
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral charcoal-blue for a polished corporate look.',
    accent: PRESET_ACCENTS.slate,
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm orange accents that feel friendly and approachable.',
    accent: PRESET_ACCENTS.sunset,
  },
  {
    id: 'plum',
    label: 'Plum',
    description: 'Rich purple tones for a premium boutique presence.',
    accent: PRESET_ACCENTS.plum,
  },
];

export function isTenantSiteTemplate(value: string): value is TenantSiteTemplate {
  return (TENANT_SITE_TEMPLATES as readonly string[]).includes(value);
}

export function isTenantSiteColorScheme(value: string): value is TenantSiteColorScheme {
  return (TENANT_SITE_COLOR_SCHEMES as readonly string[]).includes(value);
}

export function resolveTenantSiteAccentColor(
  colorScheme: TenantSiteColorScheme,
  brandColor: string,
): string {
  if (colorScheme === 'brand') {
    return brandColor.trim() || DEFAULT_BRAND_COLOR;
  }
  return PRESET_ACCENTS[colorScheme];
}

export function resolveTenantSiteThemeStyle(
  template: TenantSiteTemplate,
  colorScheme: TenantSiteColorScheme,
  brandColor: string,
): CSSProperties {
  const accent = resolveTenantSiteAccentColor(colorScheme, brandColor);

  return {
    ['--tenant-brand' as string]: accent,
    ['--tenant-site-template' as string]: template,
  };
}
