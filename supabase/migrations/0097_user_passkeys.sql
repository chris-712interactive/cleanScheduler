-- Passkeys we verify ourselves, so every cleanscheduler.com subdomain can use them.
-- Supabase Auth's passkey feature only allows five exact origins.

create table public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  friendly_name text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index user_passkeys_user_idx on public.user_passkeys (user_id);

comment on table public.user_passkeys is
  'WebAuthn public keys for passkey sign-in. The private key stays on the device.';

create table public.user_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  challenge text not null,
  kind text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint user_passkey_challenges_kind_check
    check (kind in ('registration', 'authentication'))
);

create index user_passkey_challenges_expires_idx
  on public.user_passkey_challenges (expires_at);

comment on table public.user_passkey_challenges is
  'Short-lived WebAuthn challenges. Registration rows are bound to a user; sign-in rows are not.';

create table public.user_passkey_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.user_passkey_sessions is
  'Supabase sessions that were opened after a successful passkey check.';

alter table public.user_passkeys enable row level security;
alter table public.user_passkey_challenges enable row level security;
alter table public.user_passkey_sessions enable row level security;

revoke all on table public.user_passkeys from anon, authenticated;
revoke all on table public.user_passkey_challenges from anon, authenticated;
revoke all on table public.user_passkey_sessions from anon, authenticated;

grant select, insert, update, delete on table public.user_passkeys to service_role;
grant select, insert, update, delete on table public.user_passkey_challenges to service_role;
grant select, insert, update, delete on table public.user_passkey_sessions to service_role;
