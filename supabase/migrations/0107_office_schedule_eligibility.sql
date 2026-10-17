-- Owners and admins can stay off service visits, consultations, or both.

alter table public.tenant_memberships
  add column if not exists exclude_from_job_schedule boolean not null default false,
  add column if not exists exclude_from_consultation_schedule boolean not null default false;

comment on column public.tenant_memberships.exclude_from_job_schedule is
  'Owner or admin is not offered for service visits. Field employees ignore this.';

comment on column public.tenant_memberships.exclude_from_consultation_schedule is
  'Owner or admin is not offered for consultations. Field employees ignore this.';
