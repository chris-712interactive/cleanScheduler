-- =============================================================================
-- 0078_platform_outreach.sql
-- Founder-admin cold outreach: campaigns, mail-merge recipients, suppressions.
-- =============================================================================

create table public.platform_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  bounced_count integer not null default 0,
  replied_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  queued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_outreach_campaigns_status_check check (
    status in ('draft', 'queued', 'sending', 'sent', 'cancelled', 'failed')
  )
);

create index platform_outreach_campaigns_created_idx
  on public.platform_outreach_campaigns (created_at desc);

create index platform_outreach_campaigns_status_idx
  on public.platform_outreach_campaigns (status);

create trigger platform_outreach_campaigns_set_updated_at
before update on public.platform_outreach_campaigns
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------

create table public.platform_outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.platform_outreach_campaigns(id) on delete cascade,
  business_name text,
  owner_name text,
  email text not null,
  email_normalized text not null,
  phone text,
  city text,
  county text,
  business_type text,
  website text,
  notes text,
  subject text not null,
  body_text text not null,
  status text not null default 'pending',
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  response_status text not null default 'none',
  response_notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_outreach_recipients_status_check check (
    status in ('pending', 'queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped')
  ),
  constraint platform_outreach_recipients_response_status_check check (
    response_status in ('none', 'replied', 'interested', 'not_interested', 'do_not_contact')
  )
);

create index platform_outreach_recipients_campaign_status_idx
  on public.platform_outreach_recipients (campaign_id, status);

create index platform_outreach_recipients_campaign_response_idx
  on public.platform_outreach_recipients (campaign_id, response_status);

create index platform_outreach_recipients_resend_email_idx
  on public.platform_outreach_recipients (resend_email_id)
  where resend_email_id is not null;

create index platform_outreach_recipients_queued_idx
  on public.platform_outreach_recipients (status, created_at)
  where status = 'queued';

create trigger platform_outreach_recipients_set_updated_at
before update on public.platform_outreach_recipients
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------

create table public.platform_outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  reason text not null,
  source text not null default 'manual',
  campaign_id uuid references public.platform_outreach_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_outreach_suppressions_email_unique unique (email_normalized),
  constraint platform_outreach_suppressions_reason_check check (
    reason in ('unsubscribe', 'bounce', 'complaint', 'manual')
  ),
  constraint platform_outreach_suppressions_source_check check (
    source in ('unsubscribe_link', 'manual', 'webhook', 'import')
  )
);

create index platform_outreach_suppressions_email_idx
  on public.platform_outreach_suppressions (email_normalized);

-- -----------------------------------------------------------------------------

alter table public.platform_outreach_campaigns enable row level security;
alter table public.platform_outreach_recipients enable row level security;
alter table public.platform_outreach_suppressions enable row level security;

create policy "platform_outreach_campaigns_admin_all"
  on public.platform_outreach_campaigns
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform_outreach_recipients_admin_all"
  on public.platform_outreach_recipients
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform_outreach_suppressions_admin_all"
  on public.platform_outreach_suppressions
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on table public.platform_outreach_campaigns to service_role;
grant select, insert, update, delete on table public.platform_outreach_recipients to service_role;
grant select, insert, update, delete on table public.platform_outreach_suppressions to service_role;
