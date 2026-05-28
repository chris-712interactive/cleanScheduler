-- =============================================================================
-- 0033_tenant_email_campaigns.sql
-- Email campaigns: marketing opt-in, suppressions, campaigns, recipients, webhooks
-- =============================================================================

alter table public.tenant_customer_profiles
  add column if not exists marketing_email_opt_in boolean not null default false;

comment on column public.tenant_customer_profiles.marketing_email_opt_in is
  'Customer agreed to receive promotional email from this tenant.';

-- -----------------------------------------------------------------------------

create table public.tenant_email_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email_normalized text not null,
  reason text not null,
  source text not null default 'manual',
  campaign_id uuid,
  created_at timestamptz not null default now(),
  constraint tenant_email_suppressions_reason_check check (
    reason in ('unsubscribe', 'bounce', 'complaint', 'manual')
  ),
  constraint tenant_email_suppressions_source_check check (
    source in ('unsubscribe_link', 'manual', 'webhook', 'import')
  ),
  unique (tenant_id, email_normalized)
);

create index tenant_email_suppressions_tenant_idx
  on public.tenant_email_suppressions (tenant_id, email_normalized);

-- -----------------------------------------------------------------------------

create table public.tenant_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  subject text not null,
  template_key text not null,
  body_text text not null default '',
  audience_preset text not null,
  status text not null default 'draft',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  bounced_count integer not null default 0,
  unsubscribed_count integer not null default 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_email_campaigns_status_check check (
    status in ('draft', 'sending', 'sent', 'failed', 'cancelled')
  ),
  constraint tenant_email_campaigns_template_key_check check (
    template_key in ('promo', 'seasonal', 're_engagement', 'review_ask', 'service_reminder')
  ),
  constraint tenant_email_campaigns_audience_preset_check check (
    audience_preset in (
      'all_marketable',
      'email_preferred',
      'residential',
      'portal_nudge',
      'open_balance'
    )
  )
);

create index tenant_email_campaigns_tenant_created_idx
  on public.tenant_email_campaigns (tenant_id, created_at desc);

create index tenant_email_campaigns_tenant_status_idx
  on public.tenant_email_campaigns (tenant_id, status);

create trigger tenant_email_campaigns_set_updated_at
before update on public.tenant_email_campaigns
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------

create table public.tenant_email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.tenant_email_campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  resend_email_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint tenant_email_campaign_recipients_status_check check (
    status in ('pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped')
  ),
  unique (campaign_id, customer_id)
);

create index tenant_email_campaign_recipients_campaign_idx
  on public.tenant_email_campaign_recipients (campaign_id, status);

create index tenant_email_campaign_recipients_resend_email_idx
  on public.tenant_email_campaign_recipients (resend_email_id)
  where resend_email_id is not null;

-- -----------------------------------------------------------------------------

create table public.resend_webhook_events (
  id uuid primary key default gen_random_uuid(),
  resend_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index resend_webhook_events_processed_at_idx
  on public.resend_webhook_events (processed_at);

-- -----------------------------------------------------------------------------

alter table public.tenant_email_suppressions enable row level security;
alter table public.tenant_email_campaigns enable row level security;
alter table public.tenant_email_campaign_recipients enable row level security;
alter table public.resend_webhook_events enable row level security;

create policy "tenant_email_suppressions_member_read"
  on public.tenant_email_suppressions
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_email_suppressions_member_write"
  on public.tenant_email_suppressions
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_email_campaigns_member_read"
  on public.tenant_email_campaigns
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_email_campaigns_member_write"
  on public.tenant_email_campaigns
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_email_campaign_recipients_member_read"
  on public.tenant_email_campaign_recipients
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_email_suppressions to service_role;
grant select, insert, update, delete on table public.tenant_email_campaigns to service_role;
grant select, insert, update, delete on table public.tenant_email_campaign_recipients to service_role;
grant select, insert, update, delete on table public.resend_webhook_events to service_role;
