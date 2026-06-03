-- =============================================================================
-- 0065_customer_referral_program.sql
-- Tenant referral program config, customer codes, touches, and attributions.
-- =============================================================================

create type public.tenant_referral_reward_side_mode as enum (
  'referrer_only',
  'double_sided',
  'referee_only'
);

create type public.referral_attribution_status as enum (
  'pending',
  'qualified',
  'voided'
);

create table public.tenant_referral_programs (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  is_enabled boolean not null default false,
  reward_side_mode public.tenant_referral_reward_side_mode not null default 'referrer_only',
  referrer_promotion_id uuid references public.tenant_promotions (id) on delete set null,
  referee_promotion_id uuid references public.tenant_promotions (id) on delete set null,
  click_window_days int not null default 30,
  share_headline text,
  terms_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_referral_programs_click_window check (
    click_window_days >= 1 and click_window_days <= 365
  )
);

create trigger tenant_referral_programs_set_updated_at
before update on public.tenant_referral_programs
for each row execute procedure public.set_updated_at();

comment on table public.tenant_referral_programs is
  'Per-tenant customer referral program settings linked to promotion templates.';

create table public.customer_referral_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_referral_codes_code_nonempty check (char_length(trim(code)) >= 4),
  unique (tenant_id, customer_id),
  unique (tenant_id, lower(trim(code)))
);

create index customer_referral_codes_customer_idx
  on public.customer_referral_codes (tenant_id, customer_id);

create trigger customer_referral_codes_set_updated_at
before update on public.customer_referral_codes
for each row execute procedure public.set_updated_at();

comment on table public.customer_referral_codes is
  'Unique referral code per referring customer within a tenant.';

create table public.referral_touches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  referral_code_id uuid not null references public.customer_referral_codes (id) on delete cascade,
  landing_path text,
  client_ip text,
  user_agent text,
  touched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index referral_touches_code_idx
  on public.referral_touches (referral_code_id, touched_at desc);

comment on table public.referral_touches is
  'Last-click referral landing events for attribution windows.';

create table public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  referral_code_id uuid not null references public.customer_referral_codes (id) on delete restrict,
  referrer_customer_id uuid not null references public.customers (id) on delete cascade,
  referee_customer_id uuid not null references public.customers (id) on delete cascade,
  touch_id uuid references public.referral_touches (id) on delete set null,
  status public.referral_attribution_status not null default 'pending',
  attributed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_attributions_not_self check (referrer_customer_id <> referee_customer_id),
  unique (tenant_id, referee_customer_id)
);

create index referral_attributions_referrer_idx
  on public.referral_attributions (tenant_id, referrer_customer_id, status);

create trigger referral_attributions_set_updated_at
before update on public.referral_attributions
for each row execute procedure public.set_updated_at();

comment on table public.referral_attributions is
  'Links a referee customer to a referrer. Rewards are issued when status becomes qualified (PR3).';

-- Seed empty program row for existing tenants (disabled by default).
insert into public.tenant_referral_programs (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;

create or replace function public.tenants_seed_referral_program()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_referral_programs (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

create trigger tenants_seed_referral_program_trg
after insert on public.tenants
for each row execute procedure public.tenants_seed_referral_program();

revoke all on table public.tenant_referral_programs from anon, authenticated;
revoke all on table public.customer_referral_codes from anon, authenticated;
revoke all on table public.referral_touches from anon, authenticated;
revoke all on table public.referral_attributions from anon, authenticated;

grant select, insert, update, delete on table public.tenant_referral_programs to service_role;
grant select, insert, update, delete on table public.customer_referral_codes to service_role;
grant select, insert, update, delete on table public.referral_touches to service_role;
grant select, insert, update, delete on table public.referral_attributions to service_role;
