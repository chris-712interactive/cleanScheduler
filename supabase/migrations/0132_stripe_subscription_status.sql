-- Raw Stripe subscription status, kept beside the mapped tenant_billing_accounts.status.
-- Null means the row has not been written by a Stripe sync yet. Texting treats null
-- as today's mapped-status rule. A stored value of paused blocks texting and pack
-- purchases even though the mapper stores paused as active.
-- Safe to re-run by hand.

alter table public.tenant_billing_accounts
  add column if not exists stripe_subscription_status text;

comment on column public.tenant_billing_accounts.stripe_subscription_status is
  'Raw Stripe Subscription.status (active, paused, past_due, unpaid, and the rest). Null until a platform subscription sync writes it. Does not change portal access.';
