-- =============================================================================
-- 0008_stripe_webhook_idempotency.sql
-- =============================================================================
-- Deduplicate Stripe platform webhook deliveries (retries must be safe).

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events (processed_at);

alter table public.stripe_webhook_events enable row level security;

grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
