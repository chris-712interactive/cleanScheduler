-- =============================================================================
-- 0092_platform_sales_pipeline.sql
-- Sales CRM for platform staff: leads, demos, tasks. Sales can use admin
-- outreach + this pipeline; they do not get is_platform_admin() privileges.
-- =============================================================================

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in (
    'super_admin'::public.app_role,
    'admin'::public.app_role,
    'sales'::public.app_role
  );
$$;

comment on function public.is_platform_staff() is
  'Founder admins and sales closers. Use for outreach and sales CRM RLS.';

-- Outreach: sales needs campaign + recipient access.
drop policy if exists "platform_outreach_campaigns_admin_all" on public.platform_outreach_campaigns;
drop policy if exists "platform_outreach_recipients_admin_all" on public.platform_outreach_recipients;
drop policy if exists "platform_outreach_suppressions_admin_all" on public.platform_outreach_suppressions;

create policy "platform_outreach_campaigns_staff_all"
  on public.platform_outreach_campaigns
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "platform_outreach_recipients_staff_all"
  on public.platform_outreach_recipients
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "platform_outreach_suppressions_staff_all"
  on public.platform_outreach_suppressions
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------

create table public.platform_sales_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text,
  email text,
  email_normalized text,
  phone text,
  website text,
  city text,
  county text,
  state text,
  source text not null default 'manual',
  stage text not null default 'new',
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  outreach_recipient_id uuid references public.platform_outreach_recipients(id) on delete set null,
  tenant_id uuid unique references public.tenants(id) on delete set null,
  last_contacted_at timestamptz,
  demo_at timestamptz,
  lost_reason text,
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sales_leads_source_check check (
    source in ('manual', 'outreach', 'inbound', 'trial')
  ),
  constraint platform_sales_leads_stage_check check (
    stage in (
      'new',
      'contacted',
      'demo_scheduled',
      'demo_completed',
      'trial',
      'negotiating',
      'won',
      'lost',
      'do_not_contact'
    )
  )
);

create unique index platform_sales_leads_email_normalized_uidx
  on public.platform_sales_leads (email_normalized)
  where email_normalized is not null;

create unique index platform_sales_leads_outreach_recipient_uidx
  on public.platform_sales_leads (outreach_recipient_id)
  where outreach_recipient_id is not null;

create index platform_sales_leads_stage_idx
  on public.platform_sales_leads (stage, updated_at desc);

create index platform_sales_leads_assigned_idx
  on public.platform_sales_leads (assigned_to_user_id, stage);

create trigger platform_sales_leads_set_updated_at
before update on public.platform_sales_leads
for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Activities (including demos)
-- -----------------------------------------------------------------------------

create table public.platform_sales_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.platform_sales_leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  demo_at timestamptz,
  demo_outcome text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint platform_sales_activities_kind_check check (
    kind in ('note', 'outreach', 'call', 'email', 'demo', 'stage_change', 'task')
  ),
  constraint platform_sales_activities_demo_outcome_check check (
    demo_outcome is null
    or demo_outcome in (
      'scheduled',
      'completed',
      'no_show',
      'rescheduled',
      'cancelled',
      'interested',
      'not_interested'
    )
  )
);

create index platform_sales_activities_lead_idx
  on public.platform_sales_activities (lead_id, occurred_at desc);

create index platform_sales_activities_demo_idx
  on public.platform_sales_activities (demo_at)
  where kind = 'demo' and demo_at is not null;

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------

create table public.platform_sales_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.platform_sales_leads(id) on delete cascade,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'follow_up',
  title text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_from text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sales_tasks_kind_check check (
    kind in ('follow_up', 'demo', 'trial_expiring')
  ),
  constraint platform_sales_tasks_created_from_check check (
    created_from in ('manual', 'trial_expiry_cron', 'demo')
  )
);

create index platform_sales_tasks_open_due_idx
  on public.platform_sales_tasks (due_at)
  where completed_at is null;

create index platform_sales_tasks_assignee_open_idx
  on public.platform_sales_tasks (assigned_to_user_id, due_at)
  where completed_at is null;

create unique index platform_sales_tasks_open_trial_uidx
  on public.platform_sales_tasks (lead_id)
  where kind = 'trial_expiring' and completed_at is null;

create trigger platform_sales_tasks_set_updated_at
before update on public.platform_sales_tasks
for each row execute procedure public.set_updated_at();

alter table public.platform_sales_leads enable row level security;
alter table public.platform_sales_activities enable row level security;
alter table public.platform_sales_tasks enable row level security;

create policy "platform_sales_leads_staff_all"
  on public.platform_sales_leads
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "platform_sales_activities_staff_all"
  on public.platform_sales_activities
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "platform_sales_tasks_staff_all"
  on public.platform_sales_tasks
  for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on table public.platform_sales_leads to service_role;
grant select, insert, update, delete on table public.platform_sales_activities to service_role;
grant select, insert, update, delete on table public.platform_sales_tasks to service_role;
