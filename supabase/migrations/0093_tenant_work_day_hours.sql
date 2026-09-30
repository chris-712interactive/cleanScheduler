-- Per-day business hours. Null keeps the older single start/end for every open day.

alter table public.tenants
  add column if not exists work_day_hours jsonb;

comment on column public.tenants.work_day_hours is
  'Optional hours per weekday. Keys are mon..sun with {start,end} as HH:MM. Missing keys are closed. Null means work_week_days plus work_day_start/end apply to every open day.';
