-- Proof-of-service photos attached when a visit is marked complete.

create table if not exists public.tenant_visit_proof_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  visit_id uuid not null references public.tenant_scheduled_visits (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  uploaded_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_visit_proof_photos_visit_id_idx
  on public.tenant_visit_proof_photos (visit_id);

create index if not exists tenant_visit_proof_photos_tenant_id_idx
  on public.tenant_visit_proof_photos (tenant_id);

comment on table public.tenant_visit_proof_photos is
  'Photos captured at visit completion. Business+ staff upload; Pro customers see them in the portal.';

-- Public read bucket (paths are unguessable UUIDs under tenant/visit folders).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit_proof_photos',
  'visit_proof_photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "visit_proof_photos_select_public" on storage.objects;
create policy "visit_proof_photos_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'visit_proof_photos');
