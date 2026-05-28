-- =============================================================================
-- 0014_customer_portal_invites.sql
-- =============================================================================
-- Tokenized invites so tenants can email customers to finish portal signup
-- on my.<apex> (links auth.users to existing customer_identities).

create table public.customer_portal_invites (
  token uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_identity_id uuid not null references public.customer_identities(id) on delete cascade,
  email_normalized text not null,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_portal_invites_customer_idx on public.customer_portal_invites (customer_id);
create index customer_portal_invites_expires_idx on public.customer_portal_invites (expires_at);

revoke all on table public.customer_portal_invites from anon;
revoke all on table public.customer_portal_invites from authenticated;
grant select, insert, update, delete on table public.customer_portal_invites to service_role;
