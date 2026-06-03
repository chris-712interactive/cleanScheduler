-- =============================================================================
-- 0066_referral_reward_events.sql
-- Idempotent referral reward issuance when attributions qualify.
-- =============================================================================

create type public.referral_reward_recipient as enum ('referrer', 'referee');

create table public.referral_reward_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  attribution_id uuid not null references public.referral_attributions (id) on delete cascade,
  recipient public.referral_reward_recipient not null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  promotion_id uuid references public.tenant_promotions (id) on delete set null,
  amount_applied_cents bigint not null default 0,
  promotion_redemption_id uuid references public.tenant_promotion_redemptions (id) on delete set null,
  wallet_transaction_id uuid references public.tenant_customer_wallet_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (attribution_id, recipient),
  constraint referral_reward_events_amount_nonneg check (amount_applied_cents >= 0)
);

create index referral_reward_events_customer_idx
  on public.referral_reward_events (tenant_id, customer_id, created_at desc);

comment on table public.referral_reward_events is
  'Audit + idempotency for referral wallet rewards issued on qualification.';

alter table public.referral_attributions
  add column if not exists qualified_at timestamptz;

comment on column public.referral_attributions.qualified_at is
  'When the referee first paid invoice qualified this referral.';

revoke all on table public.referral_reward_events from anon, authenticated;
grant select, insert, update, delete on table public.referral_reward_events to service_role;
