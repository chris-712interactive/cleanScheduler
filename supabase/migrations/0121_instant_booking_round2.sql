-- =============================================================================
-- 0121_instant_booking_round2.sql
-- Full price on later recurring visits, time off rechecked at finalize,
-- and travel helpers are not executable by public.
-- =============================================================================

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

  for rec in
    select t.starts_at, t.ends_at
    from public.tenant_member_time_off t
    where t.tenant_id = p_tenant_id
      and t.user_id = p_assignee
      and t.status = 'approved'
  loop
    if public.instant_booking_ranges_conflict(
      p_starts, p_ends, rec.starts_at, rec.ends_at, greatest(0, coalesce(p_buffer, 0))
    ) then
      return true;
    end if;
  end loop;

  return false;
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
      b.duration_minutes, 60, true, b.price_cents
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


revoke all on function public.instant_booking_state_abbr(text) from public, anon, authenticated;
revoke all on function public.instant_booking_travel_minutes(
  double precision, double precision, text, text, text,
  double precision, double precision, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.instant_booking_ranges_conflict(
  timestamptz, timestamptz, timestamptz, timestamptz, integer
) from public, anon, authenticated;

grant execute on function public.instant_booking_state_abbr(text) to service_role;
grant execute on function public.instant_booking_travel_minutes(
  double precision, double precision, text, text, text,
  double precision, double precision, text, text, text, integer
) to service_role;
grant execute on function public.instant_booking_ranges_conflict(
  timestamptz, timestamptz, timestamptz, timestamptz, integer
) to service_role;
