-- Platform-wide signup email blocks (survive tenant purge / delete).
-- Blocks self-serve workspace / trial owner signup by email; not tied to tenants via FK.

create table if not exists public.platform_signup_email_blocks (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  reason text,
  source text not null default 'manual',
  -- Provenance only — intentionally NOT a foreign key so purge does not clear the block.
  source_tenant_id uuid,
  source_tenant_slug text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_signup_email_blocks_email_unique unique (email_normalized),
  constraint platform_signup_email_blocks_source_check check (
    source in ('manual', 'admin_tenant', 'fraud')
  )
);

comment on table public.platform_signup_email_blocks is
  'Emails banned from self-serve tenant/workspace signup. Independent of tenants; survives purge.';

comment on column public.platform_signup_email_blocks.source_tenant_id is
  'Optional historical tenant id when blocked from a tenant risk action; not a FK.';

create index if not exists platform_signup_email_blocks_created_idx
  on public.platform_signup_email_blocks (created_at desc);

alter table public.platform_signup_email_blocks enable row level security;

-- Service role only (platform admin uses service role client). No authenticated policies.

grant select, insert, update, delete on table public.platform_signup_email_blocks to service_role;
