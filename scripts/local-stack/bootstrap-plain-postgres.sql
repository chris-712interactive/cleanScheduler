-- Minimal auth, storage, and API roles for applying cleanScheduler migrations
-- on plain Postgres when Docker cannot start the Supabase stack.
-- The Supabase CLI image already has these objects. Do not run this there.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    nullif(current_setting('request.jwt.claim', true), '')
  )::jsonb;
$$;

grant usage on schema auth to anon, authenticated, service_role, public;
grant execute on function auth.uid() to anon, authenticated, service_role, public;
grant execute on function auth.jwt() to anon, authenticated, service_role, public;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role, public;
grant select, insert, update, delete on storage.buckets to postgres, service_role;
grant select, insert, update, delete on storage.objects to postgres, service_role;
