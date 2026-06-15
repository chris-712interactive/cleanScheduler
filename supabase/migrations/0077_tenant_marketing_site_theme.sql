-- =============================================================================
-- 0077_tenant_marketing_site_theme.sql
-- =============================================================================
-- Layout templates and color schemes for tenant marketing sites.

create type public.tenant_marketing_site_template as enum ('classic', 'modern', 'editorial');

create type public.tenant_marketing_site_color_scheme as enum (
  'brand',
  'ocean',
  'forest',
  'slate',
  'sunset',
  'plum'
);

alter table public.tenant_marketing_site_settings
  add column site_template public.tenant_marketing_site_template not null default 'classic',
  add column color_scheme public.tenant_marketing_site_color_scheme not null default 'brand';

comment on column public.tenant_marketing_site_settings.site_template is
  'Public site layout personality: classic (centered), modern (split hero), editorial (typography-led).';

comment on column public.tenant_marketing_site_settings.color_scheme is
  'Accent palette for the public site. brand uses the tenant brand_color; others are curated presets.';
