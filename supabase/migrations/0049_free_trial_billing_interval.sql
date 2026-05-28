-- DB-only free trial: billing interval + trial-ending reminder tracking.

create type public.platform_billing_interval as enum ('month', 'year');

alter table public.tenant_billing_accounts
  add column if not exists billing_interval public.platform_billing_interval,
  add column if not exists trial_ending_reminder_sent_at timestamptz;

comment on column public.tenant_billing_accounts.platform_plan is
  'Platform tier (Starter/Business/Pro). NULL during DB-only free trial before first subscription.';

comment on column public.tenant_billing_accounts.billing_interval is
  'Recurring interval for the active Stripe platform subscription. NULL until first paid subscription.';

comment on column public.tenant_billing_accounts.trial_ending_reminder_sent_at is
  'When the owner was emailed that a DB-only trial ends in ~3 days (Resend). NULL until sent.';
