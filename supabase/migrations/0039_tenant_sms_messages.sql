-- SMS send log (metering + audit) and visit reminder toggle.

create table public.tenant_sms_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  to_phone_e164 text not null,
  body_preview text not null,
  segment_count integer not null default 1 check (segment_count >= 1),
  purpose text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  twilio_sid text null,
  error_message text null,
  related_visit_id uuid null references public.tenant_scheduled_visits (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tenant_sms_messages_tenant_created_idx
  on public.tenant_sms_messages (tenant_id, created_at desc);

create unique index tenant_sms_messages_visit_purpose_unique_idx
  on public.tenant_sms_messages (tenant_id, related_visit_id, purpose)
  where related_visit_id is not null and status = 'sent';

alter table public.tenant_operational_settings
  add column if not exists sms_notify_visit_reminder boolean not null default false;

comment on table public.tenant_sms_messages is
  'Transactional SMS audit log; segment_count drives monthly Pro plan metering.';

comment on column public.tenant_operational_settings.sms_notify_visit_reminder is
  'Send SMS ~24h before scheduled visits (Pro + Twilio).';

alter table public.tenant_sms_messages enable row level security;

revoke all on table public.tenant_sms_messages from anon;
revoke all on table public.tenant_sms_messages from authenticated;
grant select, insert, update, delete on table public.tenant_sms_messages to service_role;
