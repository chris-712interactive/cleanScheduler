-- =============================================================================
-- 0079_platform_outreach_signature.sql
-- Campaign-level branded signature fields for founder outreach emails.
-- =============================================================================

alter table public.platform_outreach_campaigns
  add column if not exists signature_enabled boolean not null default true,
  add column if not exists signature_name text,
  add column if not exists signature_title text,
  add column if not exists signature_company text,
  add column if not exists signature_email text,
  add column if not exists signature_phone text,
  add column if not exists signature_website text,
  add column if not exists signature_logo_url text;

comment on column public.platform_outreach_campaigns.signature_enabled is
  'When true, append the campaign signature block after the mail-merge body.';
comment on column public.platform_outreach_campaigns.signature_logo_url is
  'HTTPS URL for logo image shown in the email signature (no upload pipeline).';
