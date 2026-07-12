-- =============================================================================
-- 0081_platform_seo_task_completions.sql
-- Founder-admin SEO task checklist completions (catalog lives in app code).
-- =============================================================================

create table public.platform_seo_task_completions (
  task_id text primary key,
  completed_at timestamptz not null default now(),
  completed_by_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_seo_task_completions_completed_at_idx
  on public.platform_seo_task_completions (completed_at desc);

create trigger platform_seo_task_completions_set_updated_at
before update on public.platform_seo_task_completions
for each row execute procedure public.set_updated_at();

comment on table public.platform_seo_task_completions is
  'Platform admin SEO checklist completions; task definitions are versioned in lib/admin/seoTaskCatalog.ts.';

comment on column public.platform_seo_task_completions.task_id is
  'Stable id from the SEO task catalog (e.g. gsc-indexing-stripe).';

-- -----------------------------------------------------------------------------

alter table public.platform_seo_task_completions enable row level security;

create policy "platform_seo_task_completions_admin_all"
  on public.platform_seo_task_completions
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on table public.platform_seo_task_completions to service_role;
