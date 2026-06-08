-- Email staff when a customer sends or replies in the portal Messages inbox.

alter table public.tenant_operational_settings
  add column if not exists email_notify_customer_message boolean not null default true;

comment on column public.tenant_operational_settings.email_notify_customer_message is
  'When true, email tenant owner/company address when a customer starts or replies to a support thread.';
