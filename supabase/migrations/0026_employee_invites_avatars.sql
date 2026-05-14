-- =============================================================================
-- 0026_employee_invites_avatars.sql
-- =============================================================================
-- Tokenized employee invites (tenant team onboarding), optional profile avatars,
-- and a public storage bucket for uploaded images (uploads via service role).

-- -----------------------------------------------------------------------------
-- user_profiles: public avatar URL (Supabase Storage public URL or HTTPS)
-- -----------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists avatar_url text;

comment on column public.user_profiles.avatar_url is
  'Optional profile image URL (e.g. Supabase Storage public URL for employee_avatars bucket).';

-- -----------------------------------------------------------------------------
-- employee_invites (mirrors customer_portal_invites pattern — service_role only)
-- -----------------------------------------------------------------------------

create table public.employee_invites (
  token uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email_normalized text not null,
  invited_role public.tenant_role not null,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint employee_invites_role_not_owner check (invited_role <> 'owner')
);

create index employee_invites_tenant_idx on public.employee_invites (tenant_id);
create index employee_invites_expires_idx on public.employee_invites (expires_at);

revoke all on table public.employee_invites from anon;
revoke all on table public.employee_invites from authenticated;
grant select, insert, update, delete on table public.employee_invites to service_role;

-- -----------------------------------------------------------------------------
-- Storage: public bucket for avatars (RLS — public read; writes via service role)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee_avatars',
  'employee_avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "employee_avatars_select_public" on storage.objects;

create policy "employee_avatars_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'employee_avatars');
