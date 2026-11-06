-- =============================================================================
-- 0119_instant_online_booking.sql
-- Public booking mode (off / request / instant) and instant self-booking.
-- Existing rows keep current behavior: a disabled request form becomes off,
-- everyone else stays request-only. Instant is opt-in.
-- =============================================================================

create type public.public_booking_mode as enum ('off', 'request', 'instant');

create type public.instant_booking_pricing_method as enum ('flat', 'per_sqft', 'beds_baths');

create type public.instant_booking_frequency as enum ('one_time', 'weekly', 'biweekly', 'monthly');

create type public.instant_booking_status as enum ('hold', 'confirmed', 'expired', 'cancelled');

-- Residential by default so a later tenant service-segment setting can filter offers.
create type public.booking_service_audience as enum ('residential', 'commercial', 'both');

alter table public.tenant_operational_settings
  add column if not exists public_booking_mode public.public_booking_mode,
  add column if not exists instant_booking_lead_time_hours integer not null default 24,
  add column if not exists instant_booking_window_days integer not null default 21,
  add column if not exists instant_booking_buffer_minutes integer not null default 30,
  add column if not exists instant_booking_slot_step_minutes integer not null default 30,
  add column if not exists instant_booking_deposit_cents integer not null default 0,
  add column if not exists instant_booking_collect_card boolean not null default false,
  add column if not exists instant_booking_allow_recurring boolean not null default true,
  add column if not exists instant_booking_allow_weekly boolean not null default true,
  add column if not exists instant_booking_allow_biweekly boolean not null default true,
  add column if not exists instant_booking_allow_monthly boolean not null default true,
  add column if not exists instant_booking_travel_mph integer not null default 25;

alter table public.tenant_operational_settings
  drop constraint if exists tenant_op_instant_lead_time_range,
  drop constraint if exists tenant_op_instant_window_range,
  drop constraint if exists tenant_op_instant_buffer_range,
  drop constraint if exists tenant_op_instant_step_range,
  drop constraint if exists tenant_op_instant_deposit_nonneg,
  drop constraint if exists tenant_op_instant_travel_range;

alter table public.tenant_operational_settings
  add constraint tenant_op_instant_lead_time_range
    check (instant_booking_lead_time_hours between 0 and 168),
  add constraint tenant_op_instant_window_range
    check (instant_booking_window_days between 1 and 90),
  add constraint tenant_op_instant_buffer_range
    check (instant_booking_buffer_minutes between 0 and 240),
  add constraint tenant_op_instant_step_range
    check (instant_booking_slot_step_minutes in (15, 30, 60)),
  add constraint tenant_op_instant_deposit_nonneg
    check (instant_booking_deposit_cents >= 0),
  add constraint tenant_op_instant_travel_range
    check (instant_booking_travel_mph between 5 and 80);

update public.tenant_operational_settings
set public_booking_mode = case
  when public_booking_request_enabled = false then 'off'::public.public_booking_mode
  else 'request'::public.public_booking_mode
end
where public_booking_mode is null;

alter table public.tenant_operational_settings
  alter column public_booking_mode set default 'request',
  alter column public_booking_mode set not null;

comment on column public.tenant_operational_settings.public_booking_mode is
  'off hides /book. request keeps the lead form. instant lets customers book a real visit.';

comment on column public.tenant_operational_settings.public_booking_request_enabled is
  'Legacy mirror of public_booking_mode <> off. Writers should set public_booking_mode.';

create or replace function public.sync_public_booking_request_enabled()
returns trigger
language plpgsql
as $$
begin
  new.public_booking_request_enabled := new.public_booking_mode <> 'off'::public.public_booking_mode;
  return new;
end;
$$;

drop trigger if exists tenant_operational_settings_sync_booking_mode
  on public.tenant_operational_settings;

create trigger tenant_operational_settings_sync_booking_mode
before insert or update of public_booking_mode on public.tenant_operational_settings
for each row execute procedure public.sync_public_booking_request_enabled();

-- -----------------------------------------------------------------------------
-- Bookable offers (residential audience until segment filtering is wired)
-- -----------------------------------------------------------------------------

create table public.tenant_instant_booking_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_plan_id uuid references public.service_plans (id) on delete set null,
  service_template_id uuid references public.tenant_service_templates (id) on delete set null,
  name text not null,
  duration_minutes integer not null default 120,
  pricing_method public.instant_booking_pricing_method not null default 'flat',
  base_amount_cents integer not null default 0,
  per_sqft_cents integer not null default 0,
  per_bedroom_cents integer not null default 0,
  per_bathroom_cents integer not null default 0,
  currency text not null default 'usd',
  audience public.booking_service_audience not null default 'residential',
  zone_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_instant_booking_offers_name_nonempty check (length(trim(name)) > 0),
  constraint tenant_instant_booking_offers_duration_pos
    check (duration_minutes > 0 and duration_minutes <= 720),
  constraint tenant_instant_booking_offers_amounts_nonneg
    check (
      base_amount_cents >= 0
      and per_sqft_cents >= 0
      and per_bedroom_cents >= 0
      and per_bathroom_cents >= 0
    ),
  constraint tenant_instant_booking_offers_sort_nonneg check (sort_order >= 0)
);

create index tenant_instant_booking_offers_tenant_active_idx
  on public.tenant_instant_booking_offers (tenant_id, is_active, sort_order);

create trigger tenant_instant_booking_offers_set_updated_at
before update on public.tenant_instant_booking_offers
for each row execute procedure public.set_updated_at();

create table public.tenant_instant_booking_zone_coverage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_zone_id uuid not null references public.tenant_service_zones (id) on delete cascade,
  postal_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, service_zone_id)
);

create trigger tenant_instant_booking_zone_coverage_set_updated_at
before update on public.tenant_instant_booking_zone_coverage
for each row execute procedure public.set_updated_at();

comment on table public.tenant_instant_booking_zone_coverage is
  'ZIP codes that map a public booking address onto a CRM service zone. Empty coverage means every address is in range.';

create or replace function public.enforce_instant_booking_offer_tenant()
returns trigger
language plpgsql
as $$
declare
  plan_tenant uuid;
  template_tenant uuid;
  zone_id uuid;
  zone_tenant uuid;
begin
  if new.service_plan_id is not null then
    select tenant_id into plan_tenant from public.service_plans where id = new.service_plan_id;
    if plan_tenant is null or plan_tenant <> new.tenant_id then
      raise exception 'instant booking offer: service plan tenant mismatch';
    end if;
  end if;

  if new.service_template_id is not null then
    select tenant_id into template_tenant
    from public.tenant_service_templates
    where id = new.service_template_id;
    if template_tenant is null or template_tenant <> new.tenant_id then
      raise exception 'instant booking offer: service template tenant mismatch';
    end if;
  end if;

  foreach zone_id in array new.zone_ids loop
    select tenant_id into zone_tenant from public.tenant_service_zones where id = zone_id;
    if zone_tenant is null or zone_tenant <> new.tenant_id then
      raise exception 'instant booking offer: service zone tenant mismatch';
    end if;
  end loop;

  return new;
end;
$$;

create trigger tenant_instant_booking_offers_tenant_enforced
before insert or update of tenant_id, service_plan_id, service_template_id, zone_ids
on public.tenant_instant_booking_offers
for each row execute procedure public.enforce_instant_booking_offer_tenant();

create or replace function public.enforce_instant_booking_zone_coverage_tenant()
returns trigger
language plpgsql
as $$
declare
  zone_tenant uuid;
begin
  select tenant_id into zone_tenant from public.tenant_service_zones where id = new.service_zone_id;
  if zone_tenant is null or zone_tenant <> new.tenant_id then
    raise exception 'instant booking zone coverage: zone tenant mismatch';
  end if;
  return new;
end;
$$;

create trigger tenant_instant_booking_zone_coverage_tenant_enforced
before insert or update of tenant_id, service_zone_id
on public.tenant_instant_booking_zone_coverage
for each row execute procedure public.enforce_instant_booking_zone_coverage_tenant();

-- -----------------------------------------------------------------------------
-- Bookings + slot locks (exclusion constraint blocks overlapping crew holds)
-- -----------------------------------------------------------------------------

create table public.tenant_instant_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  public_token text not null,
  offer_id uuid references public.tenant_instant_booking_offers (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  property_id uuid references public.tenant_customer_properties (id) on delete set null,
  visit_id uuid references public.tenant_scheduled_visits (id) on delete set null,
  recurring_rule_id uuid references public.recurring_appointment_rules (id) on delete set null,
  assignee_user_id uuid not null,
  frequency public.instant_booking_frequency not null default 'one_time',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null,
  price_cents integer not null,
  deposit_cents integer not null default 0,
  currency text not null default 'usd',
  status public.instant_booking_status not null default 'hold',
  customer_email text not null,
  customer_phone text,
  customer_name text not null,
  title text not null,
  rrule_definition text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  hold_expires_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_instant_bookings_window check (ends_at > starts_at),
  constraint tenant_instant_bookings_duration_pos check (duration_minutes > 0),
  constraint tenant_instant_bookings_price_nonneg check (price_cents >= 0 and deposit_cents >= 0),
  constraint tenant_instant_bookings_token_nonempty check (length(trim(public_token)) > 0)
);

create unique index tenant_instant_bookings_token_uidx
  on public.tenant_instant_bookings (public_token);

create index tenant_instant_bookings_tenant_created_idx
  on public.tenant_instant_bookings (tenant_id, created_at desc);

create index tenant_instant_bookings_email_created_idx
  on public.tenant_instant_bookings (tenant_id, customer_email, created_at desc);

create trigger tenant_instant_bookings_set_updated_at
before update on public.tenant_instant_bookings
for each row execute procedure public.set_updated_at();

create extension if not exists btree_gist;

create table public.tenant_booking_slot_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assignee_user_id uuid not null,
  booking_id uuid not null references public.tenant_instant_bookings (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_booking_slot_locks_window check (ends_at > starts_at)
);

create index tenant_booking_slot_locks_assignee_idx
  on public.tenant_booking_slot_locks (tenant_id, assignee_user_id, starts_at);

alter table public.tenant_booking_slot_locks
  add constraint tenant_booking_slot_locks_no_overlap
  exclude using gist (
    tenant_id with =,
    assignee_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

comment on table public.tenant_booking_slot_locks is
  'Serializes public booking for one crew member. ends_at includes the configured buffer. Expired holds are deleted inside hold_instant_booking.';

-- -----------------------------------------------------------------------------
-- Hold + finalize (service role only). Advisory lock + exclusion + visit check.
-- -----------------------------------------------------------------------------

create or replace function public.hold_instant_booking(
  p_booking_id uuid,
  p_tenant_id uuid,
  p_public_token text,
  p_offer_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_assignee_user_id uuid,
  p_frequency public.instant_booking_frequency,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_duration_minutes integer,
  p_price_cents integer,
  p_deposit_cents integer,
  p_currency text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_name text,
  p_title text,
  p_rrule_definition text,
  p_buffer_minutes integer,
  p_hold_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_end timestamptz;
  v_buffer integer := greatest(0, coalesce(p_buffer_minutes, 0));
begin
  if p_ends_at <= p_starts_at then
    raise exception 'invalid_window';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'customer_tenant_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text), hashtext(p_assignee_user_id::text));

  delete from public.tenant_booking_slot_locks
  where tenant_id = p_tenant_id
    and assignee_user_id = p_assignee_user_id
    and expires_at is not null
    and expires_at < now();

  v_lock_end := p_ends_at + make_interval(mins => v_buffer);

  if exists (
    select 1
    from public.tenant_scheduled_visits v
    join public.tenant_scheduled_visit_assignees a on a.visit_id = v.id
    where v.tenant_id = p_tenant_id
      and a.user_id = p_assignee_user_id
      and v.status = 'scheduled'
      and v.starts_at < v_lock_end
      and (v.ends_at + make_interval(mins => v_buffer)) > p_starts_at
  ) then
    raise exception 'slot_taken';
  end if;

  insert into public.tenant_instant_bookings (
    id,
    tenant_id,
    public_token,
    offer_id,
    customer_id,
    property_id,
    assignee_user_id,
    frequency,
    starts_at,
    ends_at,
    duration_minutes,
    price_cents,
    deposit_cents,
    currency,
    status,
    customer_email,
    customer_phone,
    customer_name,
    title,
    rrule_definition,
    hold_expires_at
  ) values (
    p_booking_id,
    p_tenant_id,
    p_public_token,
    p_offer_id,
    p_customer_id,
    p_property_id,
    p_assignee_user_id,
    p_frequency,
    p_starts_at,
    p_ends_at,
    p_duration_minutes,
    p_price_cents,
    p_deposit_cents,
    coalesce(nullif(trim(p_currency), ''), 'usd'),
    'hold',
    p_customer_email,
    nullif(trim(p_customer_phone), ''),
    p_customer_name,
    p_title,
    nullif(trim(p_rrule_definition), ''),
    now() + make_interval(mins => greatest(5, coalesce(p_hold_minutes, 20)))
  );

  insert into public.tenant_booking_slot_locks (
    tenant_id,
    assignee_user_id,
    booking_id,
    starts_at,
    ends_at,
    expires_at
  ) values (
    p_tenant_id,
    p_assignee_user_id,
    p_booking_id,
    p_starts_at,
    v_lock_end,
    now() + make_interval(mins => greatest(5, coalesce(p_hold_minutes, 20)))
  );

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id);
exception
  when exclusion_violation then
    raise exception 'slot_taken';
end;
$$;

create or replace function public.finalize_instant_booking(
  p_booking_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.tenant_instant_bookings%rowtype;
  v_visit_id uuid;
  v_rule_id uuid;
begin
  select * into b
  from public.tenant_instant_bookings
  where id = p_booking_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if b.status = 'confirmed' and b.visit_id is not null then
    return jsonb_build_object(
      'ok', true,
      'finalized', false,
      'visit_id', b.visit_id,
      'recurring_rule_id', b.recurring_rule_id
    );
  end if;

  if b.status <> 'hold' then
    raise exception 'booking_not_hold';
  end if;

  if b.hold_expires_at is not null and b.hold_expires_at < now() then
    raise exception 'hold_expired';
  end if;

  perform pg_advisory_xact_lock(hashtext(b.tenant_id::text), hashtext(b.assignee_user_id::text));

  insert into public.tenant_scheduled_visits (
    tenant_id,
    customer_id,
    property_id,
    title,
    starts_at,
    ends_at,
    status,
    visit_purpose,
    staffing_status,
    notes,
    expected_amount_cents
  ) values (
    b.tenant_id,
    b.customer_id,
    b.property_id,
    b.title,
    b.starts_at,
    b.ends_at,
    'scheduled',
    'service',
    'assigned',
    'Booked online by the customer.',
    b.price_cents
  )
  returning id into v_visit_id;

  insert into public.tenant_scheduled_visit_assignees (visit_id, user_id)
  values (v_visit_id, b.assignee_user_id);

  if b.rrule_definition is not null and length(trim(b.rrule_definition)) > 0 then
    insert into public.recurring_appointment_rules (
      tenant_id,
      customer_id,
      property_id,
      title,
      rrule_definition,
      anchor_starts_at,
      visit_duration_minutes,
      horizon_days,
      is_active,
      expected_amount_cents
    ) values (
      b.tenant_id,
      b.customer_id,
      b.property_id,
      b.title,
      b.rrule_definition,
      b.starts_at,
      b.duration_minutes,
      60,
      true,
      b.price_cents
    )
    returning id into v_rule_id;

    update public.tenant_scheduled_visits
    set recurring_rule_id = v_rule_id
    where id = v_visit_id;
  end if;

  delete from public.tenant_booking_slot_locks
  where booking_id = b.id;

  update public.tenant_instant_bookings
  set
    status = 'confirmed',
    visit_id = v_visit_id,
    recurring_rule_id = v_rule_id,
    hold_expires_at = null,
    updated_at = now()
  where id = b.id;

  return jsonb_build_object(
    'ok', true,
    'finalized', true,
    'visit_id', v_visit_id,
    'recurring_rule_id', v_rule_id
  );
end;
$$;

revoke all on function public.hold_instant_booking(
  uuid, uuid, text, uuid, uuid, uuid, uuid, public.instant_booking_frequency,
  timestamptz, timestamptz, integer, integer, integer, text, text, text, text, text, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.hold_instant_booking(
  uuid, uuid, text, uuid, uuid, uuid, uuid, public.instant_booking_frequency,
  timestamptz, timestamptz, integer, integer, integer, text, text, text, text, text, text, integer, integer
) to service_role;

revoke all on function public.finalize_instant_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_instant_booking(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- RLS: members manage settings data. Public traffic uses the service role.
-- -----------------------------------------------------------------------------

alter table public.tenant_instant_booking_offers enable row level security;
alter table public.tenant_instant_booking_zone_coverage enable row level security;
alter table public.tenant_instant_bookings enable row level security;
alter table public.tenant_booking_slot_locks enable row level security;

create policy "tenant_instant_booking_offers_member_all"
  on public.tenant_instant_booking_offers
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_instant_booking_zone_coverage_member_all"
  on public.tenant_instant_booking_zone_coverage
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_instant_bookings_member_all"
  on public.tenant_instant_bookings
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_booking_slot_locks_member_all"
  on public.tenant_booking_slot_locks
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_instant_booking_offers to service_role;
grant select, insert, update, delete on table public.tenant_instant_booking_zone_coverage to service_role;
grant select, insert, update, delete on table public.tenant_instant_bookings to service_role;
grant select, insert, update, delete on table public.tenant_booking_slot_locks to service_role;

revoke all on table public.tenant_instant_booking_offers from anon;
revoke all on table public.tenant_instant_booking_zone_coverage from anon;
revoke all on table public.tenant_instant_bookings from anon;
revoke all on table public.tenant_booking_slot_locks from anon;
