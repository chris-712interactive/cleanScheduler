-- Platform admins can mark a workspace as an active Starter, Business, or Pro
-- plan without Stripe Checkout. Null means access still comes from the trial
-- or from a Stripe subscription. Checkout and subscription webhooks clear it
-- once Stripe is billing the workspace.

alter table public.tenant_billing_accounts
  add column if not exists admin_granted_at timestamptz;

comment on column public.tenant_billing_accounts.admin_granted_at is
  'When a platform admin set an active plan without Stripe Checkout. Null while access comes from the free trial or a Stripe subscription. Excluded from estimated MRR.';
