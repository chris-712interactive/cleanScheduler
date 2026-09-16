-- Platform admin fraud controls: suspend tenant portal access and freeze Connect charges
-- independently of billing-driven tenants.is_active (webhooks must not clear these).

alter table public.tenants
  add column if not exists admin_access_suspended_at timestamptz,
  add column if not exists admin_access_suspended_reason text,
  add column if not exists connect_charges_frozen_at timestamptz,
  add column if not exists connect_charges_frozen_reason text;

comment on column public.tenants.admin_access_suspended_at is
  'When set by platform admin, tenant portal access is blocked (fraud / abuse). Not cleared by Stripe billing webhooks.';

comment on column public.tenants.admin_access_suspended_reason is
  'Optional reason shown in admin UI / audit for portal suspension.';

comment on column public.tenants.connect_charges_frozen_at is
  'When set by platform admin, Connect Checkout / card charges are blocked even if stripe_connect_status=complete.';

comment on column public.tenants.connect_charges_frozen_reason is
  'Optional reason for Connect charge freeze.';
