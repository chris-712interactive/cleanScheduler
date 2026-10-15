-- Email the customer when staff replies, and publish new messages for live portal alerts.

alter table public.tenant_operational_settings
  add column if not exists email_notify_staff_reply boolean not null default true;

comment on column public.tenant_operational_settings.email_notify_staff_reply is
  'When true, email the customer when staff replies on a support thread.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'customer_support_messages'
     ) then
    alter publication supabase_realtime add table public.customer_support_messages;
  end if;
end $$;
