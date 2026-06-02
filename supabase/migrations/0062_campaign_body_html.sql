-- Rich HTML body for marketing campaign emails (plain body_text remains fallback).

alter table public.tenant_email_campaigns
  add column if not exists body_html text not null default '';

comment on column public.tenant_email_campaigns.body_html is
  'Sanitized HTML message body; merge tags like {{first_name}} are resolved at send time.';
