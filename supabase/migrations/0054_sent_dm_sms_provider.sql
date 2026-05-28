-- sent.dm SMS provider: rename Twilio sid, delivery status, tenant channel prefs.

alter table public.tenant_sms_messages
  rename column twilio_sid to provider_message_id;

comment on column public.tenant_sms_messages.provider_message_id is
  'Outbound message id from SMS provider (historical Twilio SID or sent.dm message UUID).';

alter table public.tenant_sms_messages
  add column if not exists delivery_status text null
    check (delivery_status in ('queued', 'sent', 'delivered', 'failed', 'read'));

alter table public.tenant_sms_messages
  add column if not exists channel text not null default 'sms';

comment on column public.tenant_sms_messages.channel is
  'sent.dm channel used for this outbound row (sms, whatsapp, rcs).';

drop index if exists public.tenant_sms_messages_visit_purpose_unique_idx;

create unique index tenant_sms_messages_visit_purpose_channel_unique_idx
  on public.tenant_sms_messages (tenant_id, related_visit_id, purpose, channel)
  where related_visit_id is not null and status = 'sent';

alter table public.tenant_operational_settings
  add column if not exists messaging_channels text[] not null default array['sms']::text[];

alter table public.tenant_operational_settings
  drop constraint if exists tenant_operational_settings_messaging_channels_check;

alter table public.tenant_operational_settings
  add constraint tenant_operational_settings_messaging_channels_check
  check (
    messaging_channels <@ array['sms', 'whatsapp', 'rcs']::text[]
    and cardinality(messaging_channels) >= 1
    and 'sms' = any (messaging_channels)
  );

comment on column public.tenant_operational_settings.messaging_channels is
  'sent.dm delivery channels for transactional messages. Default SMS only.';

comment on column public.tenant_operational_settings.sms_notify_visit_reminder is
  'Send SMS ~24h before scheduled visits (Pro + sent.dm).';
