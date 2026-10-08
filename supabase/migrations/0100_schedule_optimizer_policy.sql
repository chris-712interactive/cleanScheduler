-- Company-weighted scheduling policy. Empty object means the built-in defaults.

alter table public.tenant_operational_settings
  add column if not exists schedule_optimizer_policy jsonb not null default '{}'::jsonb;

comment on column public.tenant_operational_settings.schedule_optimizer_policy is
  'Which scheduling factors are enabled, how heavily each one counts, and drive-time assumptions. Unknown keys are ignored.';
