-- Business profile, branding, address, and default work-week fields on tenants.

alter table public.tenants
  add column if not exists business_email text,
  add column if not exists business_phone text,
  add column if not exists brand_color text,
  add column if not exists logo_url text,
  add column if not exists address_line1 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'US',
  add column if not exists work_week_days text[] not null default array['mon','tue','wed','thu','fri'],
  add column if not exists work_day_start time not null default '08:00',
  add column if not exists work_day_end time not null default '17:00';

comment on column public.tenants.business_email is 'Public-facing business contact email for this workspace.';
comment on column public.tenants.business_phone is 'Public-facing business phone for this workspace.';
comment on column public.tenants.brand_color is 'Hex brand color, e.g. #0D9488.';
comment on column public.tenants.logo_url is 'Public URL for tenant logo (tenant_logos storage bucket).';
comment on column public.tenants.work_week_days is 'Default business days (mon..sun).';

-- Storage: public bucket for tenant logos (writes via service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant_logos',
  'tenant_logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "tenant_logos_select_public" on storage.objects;
create policy "tenant_logos_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'tenant_logos');
