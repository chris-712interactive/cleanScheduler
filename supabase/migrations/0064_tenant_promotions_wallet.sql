-- =============================================================================
-- 0064_tenant_promotions_wallet.sql
-- Tenant-defined promo codes, redemptions, and customer wallet credits.
-- =============================================================================

create type public.tenant_promotion_type as enum (
  'percent',
  'fixed_cents',
  'account_credit'
);

create type public.tenant_promotion_usage_type as enum (
  'single_use',
  'single_use_per_customer',
  'ongoing',
  'limited'
);

create type public.tenant_promotion_redemption_status as enum (
  'pending',
  'completed',
  'voided'
);

create type public.tenant_customer_wallet_transaction_kind as enum (
  'credit_grant',
  'credit_apply',
  'credit_reverse',
  'manual_adjustment'
);

create table public.tenant_promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  code text not null,
  promotion_type public.tenant_promotion_type not null,
  promotion_value bigint not null default 0,
  usage_type public.tenant_promotion_usage_type not null default 'single_use_per_customer',
  max_redemptions int,
  max_redemptions_per_customer int not null default 1,
  min_purchase_cents bigint,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  is_referral_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_promotions_code_nonempty check (char_length(trim(code)) >= 2),
  constraint tenant_promotions_name_nonempty check (char_length(trim(name)) >= 1),
  constraint tenant_promotions_value_nonneg check (promotion_value >= 0),
  constraint tenant_promotions_max_redemptions_nonneg check (
    max_redemptions is null or max_redemptions > 0
  ),
  constraint tenant_promotions_max_per_customer_nonneg check (max_redemptions_per_customer > 0),
  constraint tenant_promotions_min_purchase_nonneg check (
    min_purchase_cents is null or min_purchase_cents >= 0
  )
);

create unique index tenant_promotions_tenant_code_uidx
  on public.tenant_promotions (tenant_id, lower(trim(code)));

create index tenant_promotions_tenant_active_idx
  on public.tenant_promotions (tenant_id, is_active);

create trigger tenant_promotions_set_updated_at
before update on public.tenant_promotions
for each row execute procedure public.set_updated_at();

comment on table public.tenant_promotions is
  'Tenant-defined discount codes and account-credit grants.';

create table public.tenant_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  promotion_id uuid not null references public.tenant_promotions (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete cascade,
  quote_id uuid references public.tenant_quotes (id) on delete set null,
  status public.tenant_promotion_redemption_status not null default 'pending',
  amount_applied_cents bigint not null default 0,
  redeemed_at timestamptz not null default now(),
  completed_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_promotion_redemptions_amount_nonneg check (amount_applied_cents >= 0)
);

create index tenant_promotion_redemptions_promotion_idx
  on public.tenant_promotion_redemptions (promotion_id, status);

create index tenant_promotion_redemptions_customer_idx
  on public.tenant_promotion_redemptions (tenant_id, customer_id, status);

create unique index tenant_promotion_redemptions_pending_quote_uidx
  on public.tenant_promotion_redemptions (quote_id, promotion_id)
  where quote_id is not null and status = 'pending';

create trigger tenant_promotion_redemptions_set_updated_at
before update on public.tenant_promotion_redemptions
for each row execute procedure public.set_updated_at();

comment on table public.tenant_promotion_redemptions is
  'Audit trail for promo usage. Pending rows reserve quote discounts until acceptance.';

create table public.tenant_customer_wallets (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, customer_id),
  constraint tenant_customer_wallets_balance_nonneg check (balance_cents >= 0)
);

create trigger tenant_customer_wallets_set_updated_at
before update on public.tenant_customer_wallets
for each row execute procedure public.set_updated_at();

comment on table public.tenant_customer_wallets is
  'Spendable account credit balance per customer within a tenant workspace.';

create table public.tenant_customer_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind public.tenant_customer_wallet_transaction_kind not null,
  amount_cents bigint not null,
  balance_after_cents bigint not null,
  promotion_id uuid references public.tenant_promotions (id) on delete set null,
  promotion_redemption_id uuid references public.tenant_promotion_redemptions (id) on delete set null,
  quote_id uuid references public.tenant_quotes (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint tenant_customer_wallet_transactions_amount_positive check (amount_cents > 0),
  constraint tenant_customer_wallet_transactions_balance_after_nonneg check (balance_after_cents >= 0)
);

create index tenant_customer_wallet_transactions_customer_idx
  on public.tenant_customer_wallet_transactions (tenant_id, customer_id, created_at desc);

comment on table public.tenant_customer_wallet_transactions is
  'Immutable ledger for wallet credits and debits.';

alter table public.tenant_quotes
  add column if not exists applied_promotion_id uuid references public.tenant_promotions (id) on delete set null,
  add column if not exists applied_promo_code text,
  add column if not exists wallet_credit_applied_cents bigint not null default 0;

alter table public.tenant_quotes
  add constraint tenant_quotes_wallet_credit_nonneg check (wallet_credit_applied_cents >= 0);

comment on column public.tenant_quotes.applied_promotion_id is
  'Promo code applied to this quote (discount types finalize on customer acceptance).';

comment on column public.tenant_quotes.wallet_credit_applied_cents is
  'Account credit to deduct from customer wallet when the quote is accepted.';

revoke all on table public.tenant_promotions from anon, authenticated;
revoke all on table public.tenant_promotion_redemptions from anon, authenticated;
revoke all on table public.tenant_customer_wallets from anon, authenticated;
revoke all on table public.tenant_customer_wallet_transactions from anon, authenticated;

grant select, insert, update, delete on table public.tenant_promotions to service_role;
grant select, insert, update, delete on table public.tenant_promotion_redemptions to service_role;
grant select, insert, update, delete on table public.tenant_customer_wallets to service_role;
grant select, insert, update, delete on table public.tenant_customer_wallet_transactions to service_role;
