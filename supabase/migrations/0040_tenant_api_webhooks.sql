-- Pro plan tenant API keys, outbound webhook endpoints, and delivery log.

create table public.tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  last_used_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index tenant_api_keys_key_hash_unique_idx on public.tenant_api_keys (key_hash);

create index tenant_api_keys_tenant_active_idx
  on public.tenant_api_keys (tenant_id)
  where revoked_at is null;

create table public.tenant_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  url text not null,
  description text null,
  signing_secret text not null,
  signing_secret_prefix text not null,
  event_types text[] not null default '{}',
  enabled boolean not null default true,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_webhook_endpoints_tenant_idx
  on public.tenant_webhook_endpoints (tenant_id);

create table public.tenant_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  endpoint_id uuid not null references public.tenant_webhook_endpoints (id) on delete cascade,
  event_type text not null,
  event_id text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  http_status integer null,
  response_body_preview text null,
  error_message text null,
  next_retry_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index tenant_webhook_deliveries_event_endpoint_unique_idx
  on public.tenant_webhook_deliveries (endpoint_id, event_id);

create index tenant_webhook_deliveries_retry_idx
  on public.tenant_webhook_deliveries (status, next_retry_at)
  where status = 'pending';

comment on table public.tenant_api_keys is
  'Pro plan REST API keys. Only key_hash is stored; plain key shown once on create.';

comment on table public.tenant_webhook_endpoints is
  'Pro plan outbound webhook destinations. signing_secret is service-role only.';

comment on table public.tenant_webhook_deliveries is
  'Outbound webhook delivery attempts with retry scheduling.';

alter table public.tenant_api_keys enable row level security;
alter table public.tenant_webhook_endpoints enable row level security;
alter table public.tenant_webhook_deliveries enable row level security;

revoke all on table public.tenant_api_keys from anon;
revoke all on table public.tenant_api_keys from authenticated;
grant select, insert, update, delete on table public.tenant_api_keys to service_role;

revoke all on table public.tenant_webhook_endpoints from anon;
revoke all on table public.tenant_webhook_endpoints from authenticated;
grant select, insert, update, delete on table public.tenant_webhook_endpoints to service_role;

revoke all on table public.tenant_webhook_deliveries from anon;
revoke all on table public.tenant_webhook_deliveries from authenticated;
grant select, insert, update, delete on table public.tenant_webhook_deliveries to service_role;
