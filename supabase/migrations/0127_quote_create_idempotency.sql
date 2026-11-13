-- One row per quote-wizard save attempt. The browser sends a UUID minted for that
-- visit. The unique key stops a second in-flight submit from inserting another quote.
-- follow_ups records which post-create writes finished, so a replay retries only
-- the ones that failed and does not send a channel that already succeeded.
--
-- Service role only. Apply this migration to dev and to prod before the app
-- that writes this table is deployed. Quote create fails closed until it exists.

create table public.tenant_quote_create_requests (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  idempotency_key uuid not null,
  quote_id uuid null references public.tenant_quotes (id) on delete set null,
  follow_ups jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

comment on table public.tenant_quote_create_requests is
  'Idempotency claim for tenant quote create. follow_ups is pending, ok, failed, or skipped per step. No customer secrets.';

alter table public.tenant_quote_create_requests enable row level security;

revoke all on table public.tenant_quote_create_requests from anon;
revoke all on table public.tenant_quote_create_requests from authenticated;
grant select, insert, update, delete on table public.tenant_quote_create_requests to service_role;
