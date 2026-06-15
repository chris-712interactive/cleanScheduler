-- =============================================================================
-- 0076_tenant_marketing_site.sql
-- =============================================================================
-- Tenant marketing website CMS, leads, and unified domain site_mode.

create type public.tenant_marketing_page_type as enum (
  'home',
  'services',
  'about',
  'contact',
  'faq',
  'service_area',
  'custom'
);

create type public.tenant_marketing_page_status as enum ('draft', 'published');

create type public.tenant_marketing_lead_status as enum ('new', 'contacted', 'converted', 'closed');

create type public.tenant_marketing_lead_source as enum ('contact_form', 'quote_request');

create type public.tenant_public_domain_site_mode as enum ('portal_only', 'unified');

-- -----------------------------------------------------------------------------
-- Site settings (one row per tenant)
-- -----------------------------------------------------------------------------

create table public.tenant_marketing_site_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  is_published boolean not null default false,
  homepage_slug text not null default 'home',
  default_cta_label text not null default 'Request a quote',
  default_cta_href text not null default '/contact',
  contact_email text,
  contact_phone text,
  service_area_summary text,
  social_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenant_marketing_site_settings_set_updated_at
before update on public.tenant_marketing_site_settings
for each row execute procedure public.set_updated_at();

comment on table public.tenant_marketing_site_settings is
  'Tenant marketing website global settings and publish state.';

-- -----------------------------------------------------------------------------
-- CMS pages
-- -----------------------------------------------------------------------------

create table public.tenant_marketing_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  page_type public.tenant_marketing_page_type not null default 'custom',
  status public.tenant_marketing_page_status not null default 'draft',
  sort_order int not null default 0,
  meta_title text not null default '',
  meta_description text not null default '',
  og_image_url text,
  eyebrow text not null default '',
  headline text not null default '',
  lead text not null default '',
  sections jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  related_links jsonb not null default '[]'::jsonb,
  cta_title text,
  cta_lead text,
  location_name text,
  city text,
  state text,
  postal_code text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_marketing_pages_tenant_slug_unique unique (tenant_id, slug)
);

create index tenant_marketing_pages_tenant_status_idx
  on public.tenant_marketing_pages (tenant_id, status);

create index tenant_marketing_pages_tenant_sort_idx
  on public.tenant_marketing_pages (tenant_id, sort_order);

create trigger tenant_marketing_pages_set_updated_at
before update on public.tenant_marketing_pages
for each row execute procedure public.set_updated_at();

comment on table public.tenant_marketing_pages is
  'Structured CMS pages for tenant public marketing websites.';

-- -----------------------------------------------------------------------------
-- Lead capture (contact / quote request forms)
-- -----------------------------------------------------------------------------

create table public.tenant_marketing_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_id uuid references public.tenant_marketing_pages(id) on delete set null,
  source public.tenant_marketing_lead_source not null default 'contact_form',
  name text not null,
  email text not null,
  phone text,
  message text,
  service_address_line1 text,
  service_city text,
  service_state text,
  service_postal_code text,
  status public.tenant_marketing_lead_status not null default 'new',
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_marketing_leads_tenant_created_idx
  on public.tenant_marketing_leads (tenant_id, created_at desc);

create index tenant_marketing_leads_tenant_status_idx
  on public.tenant_marketing_leads (tenant_id, status);

create trigger tenant_marketing_leads_set_updated_at
before update on public.tenant_marketing_leads
for each row execute procedure public.set_updated_at();

comment on table public.tenant_marketing_leads is
  'Inbound leads from tenant marketing site contact and quote forms.';

-- -----------------------------------------------------------------------------
-- Unified domain mode on existing portal domain table
-- -----------------------------------------------------------------------------

alter table public.tenant_customer_portal_domains
  add column if not exists site_mode public.tenant_public_domain_site_mode not null default 'portal_only';

comment on column public.tenant_customer_portal_domains.site_mode is
  'portal_only: entire hostname routes to customer portal. unified: / = marketing site, /portal/* = customer portal.';

-- -----------------------------------------------------------------------------
-- RLS: service role only (same as portal domains)
-- -----------------------------------------------------------------------------

alter table public.tenant_marketing_site_settings enable row level security;
alter table public.tenant_marketing_pages enable row level security;
alter table public.tenant_marketing_leads enable row level security;

revoke all on table public.tenant_marketing_site_settings from anon, authenticated;
revoke all on table public.tenant_marketing_pages from anon, authenticated;
revoke all on table public.tenant_marketing_leads from anon, authenticated;

grant select, insert, update, delete on table public.tenant_marketing_site_settings to service_role;
grant select, insert, update, delete on table public.tenant_marketing_pages to service_role;
grant select, insert, update, delete on table public.tenant_marketing_leads to service_role;
