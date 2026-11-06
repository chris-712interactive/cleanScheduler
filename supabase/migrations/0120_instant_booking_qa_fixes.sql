-- =============================================================================
-- 0120_instant_booking_qa_fixes.sql
-- Travel-aware holds, nullable customer until confirm, durable rate limit,
-- opaque slot tokens, and paid-booking outcomes.
-- =============================================================================

alter type public.instant_booking_status add value if not exists 'refunded';
alter type public.instant_booking_status add value if not exists 'needs_review';

alter table public.tenant_instant_bookings
  alter column customer_id drop not null;

alter table public.tenant_instant_bookings
  add column if not exists intake jsonb,
  add column if not exists invoice_id uuid references public.tenant_invoices (id) on delete set null;

comment on column public.tenant_instant_bookings.intake is
  'Address and consent captured before a customer row exists. Cleared after the visit is confirmed.';

alter table public.tenant_booking_slot_locks
  add column if not exists visit_ends_at timestamptz,
  add column if not exists place_lat double precision,
  add column if not exists place_lng double precision,
  add column if not exists place_city text,
  add column if not exists place_state text,
  add column if not exists place_postal text,
  add column if not exists travel_mph integer not null default 25,
  add column if not exists buffer_minutes integer not null default 0;

update public.tenant_booking_slot_locks
set visit_ends_at = ends_at
where visit_ends_at is null;

-- -----------------------------------------------------------------------------
-- Travel minutes. Same hops as lib/schedule/optimizer/geo.ts approximateTravelMinutes.
-- -----------------------------------------------------------------------------

create or replace function public.instant_booking_state_abbr(raw text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  names jsonb := '{
    "alabama":"al","alaska":"ak","arizona":"az","arkansas":"ar","california":"ca",
    "colorado":"co","connecticut":"ct","delaware":"de","district of columbia":"dc",
    "florida":"fl","georgia":"ga","hawaii":"hi","idaho":"id","illinois":"il",
    "indiana":"in","iowa":"ia","kansas":"ks","kentucky":"ky","louisiana":"la",
    "maine":"me","maryland":"md","massachusetts":"ma","michigan":"mi","minnesota":"mn",
    "mississippi":"ms","missouri":"mo","montana":"mt","nebraska":"ne","nevada":"nv",
    "new hampshire":"nh","new jersey":"nj","new mexico":"nm","new york":"ny",
    "north carolina":"nc","north dakota":"nd","ohio":"oh","oklahoma":"ok","oregon":"or",
    "pennsylvania":"pa","rhode island":"ri","south carolina":"sc","south dakota":"sd",
    "tennessee":"tn","texas":"tx","utah":"ut","vermont":"vt","virginia":"va",
    "washington":"wa","west virginia":"wv","wisconsin":"wi","wyoming":"wy"
  }'::jsonb;
begin
  cleaned := regexp_replace(lower(trim(coalesce(raw, ''))), '\.', '', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  if cleaned = '' then
    return null;
  end if;
  if cleaned ~ '^[a-z]{2}$' then
    return cleaned;
  end if;
  return names ->> cleaned;
end;
$$;

create or replace function public.instant_booking_travel_minutes(
  a_lat double precision,
  a_lng double precision,
  a_city text,
  a_state text,
  a_postal text,
  b_lat double precision,
  b_lng double precision,
  b_city text,
  b_state text,
  b_postal text,
  mph integer
) returns integer
language plpgsql
immutable
as $$
declare
  miles double precision;
  dlat double precision;
  dlng double precision;
  lat1 double precision;
  lat2 double precision;
  h double precision;
  a_post text;
  b_post text;
  a_st text;
  b_st text;
  a_ct text;
  b_ct text;
begin
  if a_lat is not null and a_lng is not null and b_lat is not null and b_lng is not null and coalesce(mph, 0) > 0 then
    dlat := radians(b_lat - a_lat);
    dlng := radians(b_lng - a_lng);
    lat1 := radians(a_lat);
    lat2 := radians(b_lat);
    h := power(sin(dlat / 2), 2) + cos(lat1) * cos(lat2) * power(sin(dlng / 2), 2);
    miles := 2 * 3958.8 * asin(least(1, sqrt(h)));
    return ceil((miles / mph) * 60);
  end if;

  a_post := substring(coalesce(a_postal, '') from '([0-9]{5})');
  b_post := substring(coalesce(b_postal, '') from '([0-9]{5})');
  if a_post is not null and a_post = b_post then
    return 15;
  end if;

  a_st := public.instant_booking_state_abbr(a_state);
  b_st := public.instant_booking_state_abbr(b_state);
  a_ct := nullif(regexp_replace(regexp_replace(lower(trim(coalesce(a_city, ''))), '\.', '', 'g'), '\s+', ' ', 'g'), '');
  b_ct := nullif(regexp_replace(regexp_replace(lower(trim(coalesce(b_city, ''))), '\.', '', 'g'), '\s+', ' ', 'g'), '');
  if a_ct is not null and b_ct is not null and a_st is not null and b_st is not null and a_ct = b_ct and a_st = b_st then
    return 20;
  end if;
  if a_st is not null and b_st is not null and a_st = b_st then
    return 90;
  end if;
  if a_st is not null and b_st is not null and a_st <> b_st then
    return 180;
  end if;
  return 0;
end;
$$;

create or replace function public.instant_booking_ranges_conflict(
  a_start timestamptz,
  a_end timestamptz,
  b_start timestamptz,
  b_end timestamptz,
  pad_minutes integer
) returns boolean
language sql
immutable
as $$
  select a_start < b_end + make_interval(mins => greatest(0, coalesce(pad_minutes, 0)))
     and b_start < a_end + make_interval(mins => greatest(0, coalesce(pad_minutes, 0)));
$$;

create or replace function public.instant_booking_assignee_conflict(
  p_tenant_id uuid,
  p_assignee uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_buffer integer,
  p_travel_mph integer,
  p_lat double precision,
  p_lng double precision,
  p_city text,
  p_state text,
  p_postal text,
  p_ignore_booking uuid
) returns boolean
language plpgsql
stable
as $$
declare
  rec record;
  travel integer;
  pad integer;
  other_end timestamptz;
begin
  for rec in
    select v.starts_at, v.ends_at, p.latitude, p.longitude, p.city, p.state, p.postal_code
    from public.tenant_scheduled_visits v
    join public.tenant_scheduled_visit_assignees a on a.visit_id = v.id
    left join public.tenant_customer_properties p on p.id = v.property_id
    where v.tenant_id = p_tenant_id
      and a.user_id = p_assignee
      and v.status = 'scheduled'
  loop
    travel := public.instant_booking_travel_minutes(
      rec.latitude, rec.longitude, rec.city, rec.state, rec.postal_code,
      p_lat, p_lng, p_city, p_state, p_postal, p_travel_mph
    );
    pad := greatest(0, coalesce(p_buffer, 0)) + greatest(0, coalesce(travel, 0));
    if public.instant_booking_ranges_conflict(p_starts, p_ends, rec.starts_at, rec.ends_at, pad) then
      return true;
    end if;
  end loop;

  for rec in
    select l.starts_at, coalesce(l.visit_ends_at, l.ends_at) as visit_end,
           l.place_lat, l.place_lng, l.place_city, l.place_state, l.place_postal, l.booking_id
    from public.tenant_booking_slot_locks l
    where l.tenant_id = p_tenant_id
      and l.assignee_user_id = p_assignee
      and (l.expires_at is null or l.expires_at > now())
      and (p_ignore_booking is null or l.booking_id <> p_ignore_booking)
  loop
    other_end := rec.visit_end;
    travel := public.instant_booking_travel_minutes(
      rec.place_lat, rec.place_lng, rec.place_city, rec.place_state, rec.place_postal,
      p_lat, p_lng, p_city, p_state, p_postal, p_travel_mph
    );
    pad := greatest(0, coalesce(p_buffer, 0)) + greatest(0, coalesce(travel, 0));
    if public.instant_booking_ranges_conflict(p_starts, p_ends, rec.starts_at, other_end, pad) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- Replace hold + finalize
-- -----------------------------------------------------------------------------

drop function if exists public.hold_instant_booking(
  uuid, uuid, text, uuid, uuid, uuid, uuid, public.instant_booking_frequency,
  timestamptz, timestamptz, integer, integer, integer, text, text, text, text, text, text, integer, integer
);

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
  p_hold_minutes integer,
  p_place_lat double precision,
  p_place_lng double precision,
  p_place_city text,
  p_place_state text,
  p_place_postal text,
  p_travel_mph integer,
  p_intake jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buffer integer := greatest(0, coalesce(p_buffer_minutes, 0));
  v_mph integer := greatest(5, least(80, coalesce(p_travel_mph, 25)));
  v_expires timestamptz;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'invalid_window';
  end if;

  if p_offer_id is null or not exists (
    select 1 from public.tenant_instant_booking_offers o
    where o.id = p_offer_id and o.tenant_id = p_tenant_id
  ) then
    raise exception 'offer_tenant_mismatch';
  end if;

  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = p_assignee_user_id
      and m.is_active
  ) then
    raise exception 'assignee_not_member';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'customer_tenant_mismatch';
  end if;

  if p_property_id is not null and not exists (
    select 1 from public.tenant_customer_properties p
    where p.id = p_property_id
      and p.tenant_id = p_tenant_id
      and (p_customer_id is null or p.customer_id = p_customer_id)
  ) then
    raise exception 'property_tenant_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text), hashtext(p_assignee_user_id::text));

  delete from public.tenant_booking_slot_locks
  where tenant_id = p_tenant_id
    and assignee_user_id = p_assignee_user_id
    and expires_at is not null
    and expires_at < now();

  if public.instant_booking_assignee_conflict(
    p_tenant_id, p_assignee_user_id, p_starts_at, p_ends_at, v_buffer, v_mph,
    p_place_lat, p_place_lng, p_place_city, p_place_state, p_place_postal, null
  ) then
    raise exception 'slot_taken';
  end if;

  v_expires := now() + make_interval(mins => greatest(5, coalesce(p_hold_minutes, 20)));

  insert into public.tenant_instant_bookings (
    id, tenant_id, public_token, offer_id, customer_id, property_id, assignee_user_id,
    frequency, starts_at, ends_at, duration_minutes, price_cents, deposit_cents, currency,
    status, customer_email, customer_phone, customer_name, title, rrule_definition,
    hold_expires_at, intake
  ) values (
    p_booking_id, p_tenant_id, p_public_token, p_offer_id, p_customer_id, p_property_id,
    p_assignee_user_id, p_frequency, p_starts_at, p_ends_at, p_duration_minutes,
    p_price_cents, p_deposit_cents, coalesce(nullif(trim(p_currency), ''), 'usd'),
    'hold', p_customer_email, nullif(trim(coalesce(p_customer_phone, '')), ''),
    p_customer_name, p_title, nullif(trim(coalesce(p_rrule_definition, '')), ''),
    v_expires, p_intake
  );

  insert into public.tenant_booking_slot_locks (
    tenant_id, assignee_user_id, booking_id, starts_at, ends_at, visit_ends_at, expires_at,
    place_lat, place_lng, place_city, place_state, place_postal, travel_mph, buffer_minutes
  ) values (
    p_tenant_id, p_assignee_user_id, p_booking_id, p_starts_at,
    p_ends_at + make_interval(mins => v_buffer), p_ends_at, v_expires,
    p_place_lat, p_place_lng, p_place_city, p_place_state, p_place_postal, v_mph, v_buffer
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
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.tenant_instant_bookings%rowtype;
  l public.tenant_booking_slot_locks%rowtype;
  v_visit_id uuid;
  v_rule_id uuid;
  v_expected integer;
  v_buffer integer := 0;
  v_mph integer := 25;
  v_lat double precision;
  v_lng double precision;
  v_city text;
  v_state text;
  v_postal text;
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
      'ok', true, 'finalized', false, 'visit_id', b.visit_id, 'recurring_rule_id', b.recurring_rule_id
    );
  end if;

  if b.status <> 'hold' then
    raise exception 'booking_not_hold';
  end if;

  if b.customer_id is null or b.property_id is null then
    raise exception 'customer_required';
  end if;

  if not exists (
    select 1 from public.tenant_customer_properties p
    where p.id = b.property_id and p.tenant_id = b.tenant_id and p.customer_id = b.customer_id
  ) then
    raise exception 'property_tenant_mismatch';
  end if;

  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = b.tenant_id and m.user_id = b.assignee_user_id and m.is_active
  ) then
    raise exception 'assignee_not_member';
  end if;

  select * into l
  from public.tenant_booking_slot_locks
  where booking_id = b.id
  limit 1;
  if found then
    v_buffer := coalesce(l.buffer_minutes, 0);
    v_mph := coalesce(l.travel_mph, 25);
    v_lat := l.place_lat;
    v_lng := l.place_lng;
    v_city := l.place_city;
    v_state := l.place_state;
    v_postal := l.place_postal;
  end if;

  perform pg_advisory_xact_lock(hashtext(b.tenant_id::text), hashtext(b.assignee_user_id::text));

  if public.instant_booking_assignee_conflict(
    b.tenant_id,
    b.assignee_user_id,
    b.starts_at,
    b.ends_at,
    v_buffer,
    v_mph,
    v_lat,
    v_lng,
    v_city,
    v_state,
    v_postal,
    b.id
  ) then
    raise exception 'slot_taken';
  end if;

  v_expected := greatest(0, b.price_cents - b.deposit_cents);

  insert into public.tenant_scheduled_visits (
    tenant_id, customer_id, property_id, title, starts_at, ends_at, status,
    visit_purpose, staffing_status, notes, expected_amount_cents
  ) values (
    b.tenant_id, b.customer_id, b.property_id, b.title, b.starts_at, b.ends_at,
    'scheduled', 'service', 'assigned', 'Booked online by the customer.', v_expected
  )
  returning id into v_visit_id;

  insert into public.tenant_scheduled_visit_assignees (visit_id, user_id)
  values (v_visit_id, b.assignee_user_id);

  if b.rrule_definition is not null and length(trim(b.rrule_definition)) > 0 then
    insert into public.recurring_appointment_rules (
      tenant_id, customer_id, property_id, title, rrule_definition, anchor_starts_at,
      visit_duration_minutes, horizon_days, is_active, expected_amount_cents
    ) values (
      b.tenant_id, b.customer_id, b.property_id, b.title, b.rrule_definition, b.starts_at,
      b.duration_minutes, 60, true, v_expected
    )
    returning id into v_rule_id;

    update public.tenant_scheduled_visits
    set recurring_rule_id = v_rule_id
    where id = v_visit_id;
  end if;

  delete from public.tenant_booking_slot_locks where booking_id = b.id;

  update public.tenant_instant_bookings
  set status = 'confirmed', visit_id = v_visit_id, recurring_rule_id = v_rule_id,
      hold_expires_at = null, intake = null, updated_at = now()
  where id = b.id;

  return jsonb_build_object(
    'ok', true, 'finalized', true, 'visit_id', v_visit_id, 'recurring_rule_id', v_rule_id
  );
end;
$$;

revoke all on function public.hold_instant_booking(
  uuid, uuid, text, uuid, uuid, uuid, uuid, public.instant_booking_frequency,
  timestamptz, timestamptz, integer, integer, integer, text, text, text, text, text, text,
  integer, integer, double precision, double precision, text, text, text, integer, jsonb
) from public, anon, authenticated;

grant execute on function public.hold_instant_booking(
  uuid, uuid, text, uuid, uuid, uuid, uuid, public.instant_booking_frequency,
  timestamptz, timestamptz, integer, integer, integer, text, text, text, text, text, text,
  integer, integer, double precision, double precision, text, text, text, integer, jsonb
) to service_role;

revoke all on function public.finalize_instant_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_instant_booking(uuid, uuid) to service_role;

revoke all on function public.instant_booking_assignee_conflict(
  uuid, uuid, timestamptz, timestamptz, integer, integer, double precision, double precision, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.instant_booking_assignee_conflict(
  uuid, uuid, timestamptz, timestamptz, integer, integer, double precision, double precision, text, text, text, uuid
) to service_role;

-- -----------------------------------------------------------------------------
-- Opaque slot tokens and durable public rate limit
-- -----------------------------------------------------------------------------

create table public.tenant_instant_slot_tokens (
  token text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  offer_id uuid not null,
  assignee_user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint tenant_instant_slot_tokens_token_nonempty check (length(trim(token)) > 0)
);

create index tenant_instant_slot_tokens_tenant_expires_idx
  on public.tenant_instant_slot_tokens (tenant_id, expires_at);

alter table public.tenant_instant_slot_tokens enable row level security;

create policy "tenant_instant_slot_tokens_member_all"
  on public.tenant_instant_slot_tokens
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_instant_slot_tokens to service_role;
revoke all on table public.tenant_instant_slot_tokens from anon;

create table public.public_rate_limit_buckets (
  scope text not null,
  client_key text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 0,
  primary key (scope, client_key, window_started_at),
  constraint public_rate_limit_hits_nonneg check (hit_count >= 0)
);

alter table public.public_rate_limit_buckets enable row level security;

create policy "public_rate_limit_buckets_platform_admin"
  on public.public_rate_limit_buckets
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on table public.public_rate_limit_buckets to service_role;
revoke all on table public.public_rate_limit_buckets from anon, authenticated;

create or replace function public.consume_public_rate_limit(
  p_scope text,
  p_client_key text,
  p_limit integer,
  p_window_seconds integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(trim(coalesce(p_scope, ''))) = 0 then
    raise exception 'invalid_rate_limit';
  end if;
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  insert into public.public_rate_limit_buckets (scope, client_key, window_started_at, hit_count)
  values (p_scope, left(coalesce(p_client_key, 'unknown'), 128), v_window, 1)
  on conflict (scope, client_key, window_started_at)
  do update set hit_count = public.public_rate_limit_buckets.hit_count + 1
  returning hit_count into v_hits;
  return v_hits;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, text, integer, integer) to service_role;
