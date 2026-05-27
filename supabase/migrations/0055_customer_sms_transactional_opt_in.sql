alter table public.tenant_customer_profiles
  add column if not exists sms_transactional_opt_in boolean not null default false;

alter table public.tenant_customer_profiles
  add column if not exists sms_transactional_opt_in_at timestamptz null;

comment on column public.tenant_customer_profiles.sms_transactional_opt_in is
  'Customer opt-in for transactional SMS disclosures captured at account signup.';

comment on column public.tenant_customer_profiles.sms_transactional_opt_in_at is
  'Timestamp when customer opted in to transactional SMS terms.';
