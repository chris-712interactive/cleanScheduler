-- Persistent owner getting-started checklist state (workspace-scoped).

alter table public.tenant_onboarding_profiles
  add column if not exists checklist_dismissed_at timestamptz,
  add column if not exists checklist_snoozed_until timestamptz,
  add column if not exists checklist_completed_at timestamptz,
  add column if not exists checklist_optional_skips text[] not null default '{}',
  add column if not exists checklist_completion_acknowledged_at timestamptz,
  add column if not exists survey_dismissed_at timestamptz;

comment on column public.tenant_onboarding_profiles.checklist_dismissed_at is
  'Owner dismissed the dashboard getting-started card; checklist remains at /getting-started.';

comment on column public.tenant_onboarding_profiles.checklist_snoozed_until is
  'Hide dashboard getting-started card until this timestamp (7-day snooze, repeatable until complete).';

comment on column public.tenant_onboarding_profiles.checklist_completed_at is
  'All required getting-started steps complete; hide nav badge and dashboard card.';

comment on column public.tenant_onboarding_profiles.checklist_optional_skips is
  'Optional checklist step ids the owner skipped (e.g. compensation).';

comment on column public.tenant_onboarding_profiles.checklist_completion_acknowledged_at is
  'Owner dismissed the one-time setup-complete celebration on the dashboard.';

comment on column public.tenant_onboarding_profiles.survey_dismissed_at is
  'Owner dismissed the post-signup business survey without submitting.';
