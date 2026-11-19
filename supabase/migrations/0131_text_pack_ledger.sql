-- Prepaid text packs. Segments carry over until used. They are not a monthly plan.
-- Tenant members can read their own ledger rows. Credits are written by the
-- service role. This file is safe to re-run by hand.

create table if not exists public.tenant_text_pack_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  segments integer not null check (segments <> 0),
  kind text not null check (kind in ('purchase', 'use', 'refund')),
  stripe_checkout_session_id text,
  pack_key text,
  amount_cents integer,
  created_at timestamptz not null default now(),
  constraint tenant_text_pack_ledger_pack_key_check check (
    pack_key is null or pack_key in ('pack_1000', 'pack_2500')
  ),
  constraint tenant_text_pack_ledger_amount_check check (
    amount_cents is null or amount_cents > 0
  ),
  constraint tenant_text_pack_ledger_shape_check check (
    (
      kind = 'purchase'
      and segments > 0
      and stripe_checkout_session_id is not null
      and pack_key is not null
      and amount_cents is not null
    )
    or (
      kind = 'use'
      and segments < 0
      and stripe_checkout_session_id is null
      and pack_key is null
      and amount_cents is null
    )
    or (
      kind = 'refund'
      and segments > 0
      and stripe_checkout_session_id is null
      and pack_key is null
      and amount_cents is null
    )
  )
);

create unique index if not exists tenant_text_pack_ledger_session_uidx
  on public.tenant_text_pack_ledger (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists tenant_text_pack_ledger_tenant_idx
  on public.tenant_text_pack_ledger (tenant_id, created_at desc);

comment on table public.tenant_text_pack_ledger is
  'Prepaid text pack segments for one tenant. Purchases are positive and do not expire monthly. Use rows are negative. The running sum for a tenant cannot go below zero.';

alter table public.tenant_text_pack_ledger enable row level security;
alter table public.tenant_text_pack_ledger force row level security;

revoke all on table public.tenant_text_pack_ledger from public;
revoke all on table public.tenant_text_pack_ledger from anon;
revoke all on table public.tenant_text_pack_ledger from authenticated;
grant select on table public.tenant_text_pack_ledger to authenticated;
grant select, insert, update, delete on table public.tenant_text_pack_ledger to service_role;

drop policy if exists tenant_text_pack_ledger_member_read on public.tenant_text_pack_ledger;
create policy tenant_text_pack_ledger_member_read
  on public.tenant_text_pack_ledger
  for select
  to authenticated
  using (public.has_tenant_membership(tenant_id));

-- Open holds count against the monthly allowance until the send is logged or released.
create table if not exists public.tenant_sms_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  segment_count integer not null check (segment_count > 0),
  meter text not null check (meter in ('customer', 'applicant')),
  pack_segments integer not null default 0 check (pack_segments >= 0),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists tenant_sms_reservations_open_idx
  on public.tenant_sms_reservations (tenant_id, created_at)
  where released_at is null;

comment on table public.tenant_sms_reservations is
  'In-flight SMS allowance holds. Counted with sent messages until released.';

alter table public.tenant_sms_reservations enable row level security;
alter table public.tenant_sms_reservations force row level security;

revoke all on table public.tenant_sms_reservations from public;
revoke all on table public.tenant_sms_reservations from anon;
revoke all on table public.tenant_sms_reservations from authenticated;
grant select, insert, update, delete on table public.tenant_sms_reservations to service_role;

create or replace function public.enforce_text_pack_balance_nonnegative()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  available integer;
  target uuid;
begin
  target := coalesce(new.tenant_id, old.tenant_id);
  select coalesce(sum(segments), 0)
    into available
  from public.tenant_text_pack_ledger
  where tenant_id = target;

  if available < 0 then
    raise exception 'text pack balance cannot go below zero';
  end if;

  return null;
end;
$$;

drop trigger if exists tenant_text_pack_ledger_nonnegative on public.tenant_text_pack_ledger;
create constraint trigger tenant_text_pack_ledger_nonnegative
  after insert or update or delete
  on public.tenant_text_pack_ledger
  deferrable initially immediate
  for each row
  execute procedure public.enforce_text_pack_balance_nonnegative();

create or replace function public.consume_text_pack_segments(p_tenant uuid, p_segments integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  available integer;
begin
  if p_tenant is null or p_segments is null or p_segments <= 0 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  select coalesce(sum(segments), 0)
    into available
  from public.tenant_text_pack_ledger
  where tenant_id = p_tenant;

  if available < p_segments then
    return false;
  end if;

  insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
  values (p_tenant, -p_segments, 'use');

  return true;
end;
$$;

create or replace function public.refund_text_pack_segments(p_tenant uuid, p_segments integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant is null or p_segments is null or p_segments <= 0 then
    return;
  end if;

  insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
  values (p_tenant, p_segments, 'refund');
end;
$$;

-- Counts this month's sent messages and open holds, then reserves under one lock.
create or replace function public.reserve_sms_segments(
  p_tenant uuid,
  p_segments integer,
  p_meter text,
  p_allowance integer,
  p_separate_applicant boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start timestamptz;
  sent_used integer;
  held_used integer;
  used integer;
  allowance_left integer;
  from_pack integer;
  pack_balance integer;
  reservation uuid;
begin
  if p_tenant is null or p_segments is null or p_segments <= 0 then
    return jsonb_build_object('ok', false, 'code', 'limit_exceeded');
  end if;
  if p_meter is null or p_meter not in ('customer', 'applicant') then
    return jsonb_build_object('ok', false, 'code', 'limit_exceeded');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  month_start := date_trunc('month', (now() at time zone 'utc')) at time zone 'utc';

  select coalesce(sum(segment_count), 0)
    into sent_used
  from public.tenant_sms_messages
  where tenant_id = p_tenant
    and status = 'sent'
    and created_at >= month_start
    and (
      not coalesce(p_separate_applicant, false)
      or purpose like 'hiring\_%' escape '\'
    );

  select coalesce(sum(segment_count), 0)
    into held_used
  from public.tenant_sms_reservations
  where tenant_id = p_tenant
    and released_at is null
    and created_at >= month_start
    and (
      not coalesce(p_separate_applicant, false)
      or meter = 'applicant'
    );

  used := sent_used + held_used;
  allowance_left := greatest(0, coalesce(p_allowance, 0) - used);
  from_pack := greatest(0, p_segments - allowance_left);

  if from_pack > 0 then
    select coalesce(sum(segments), 0)
      into pack_balance
    from public.tenant_text_pack_ledger
    where tenant_id = p_tenant;

    if pack_balance < from_pack then
      return jsonb_build_object('ok', false, 'code', 'limit_exceeded');
    end if;

    insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
    values (p_tenant, -from_pack, 'use');
  end if;

  insert into public.tenant_sms_reservations (
    tenant_id, segment_count, meter, pack_segments
  )
  values (p_tenant, p_segments, p_meter, from_pack)
  returning id into reservation;

  return jsonb_build_object(
    'ok', true,
    'from_pack', from_pack,
    'reservation_id', reservation
  );
end;
$$;

create or replace function public.release_sms_reservation(
  p_reservation uuid,
  p_refund_pack boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.tenant_sms_reservations%rowtype;
begin
  if p_reservation is null then
    return;
  end if;

  select *
    into row
  from public.tenant_sms_reservations
  where id = p_reservation
  for update;

  if not found or row.released_at is not null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(row.tenant_id::text));

  if coalesce(p_refund_pack, false) and row.pack_segments > 0 then
    insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
    values (row.tenant_id, row.pack_segments, 'refund');
  end if;

  update public.tenant_sms_reservations
  set released_at = now()
  where id = row.id
    and released_at is null;
end;
$$;

revoke all on function public.consume_text_pack_segments(uuid, integer) from public;
revoke all on function public.consume_text_pack_segments(uuid, integer) from anon;
revoke all on function public.consume_text_pack_segments(uuid, integer) from authenticated;
grant execute on function public.consume_text_pack_segments(uuid, integer) to service_role;

revoke all on function public.refund_text_pack_segments(uuid, integer) from public;
revoke all on function public.refund_text_pack_segments(uuid, integer) from anon;
revoke all on function public.refund_text_pack_segments(uuid, integer) from authenticated;
grant execute on function public.refund_text_pack_segments(uuid, integer) to service_role;

revoke all on function public.reserve_sms_segments(uuid, integer, text, integer, boolean) from public;
revoke all on function public.reserve_sms_segments(uuid, integer, text, integer, boolean) from anon;
revoke all on function public.reserve_sms_segments(uuid, integer, text, integer, boolean) from authenticated;
grant execute on function public.reserve_sms_segments(uuid, integer, text, integer, boolean) to service_role;

revoke all on function public.release_sms_reservation(uuid, boolean) from public;
revoke all on function public.release_sms_reservation(uuid, boolean) from anon;
revoke all on function public.release_sms_reservation(uuid, boolean) from authenticated;
grant execute on function public.release_sms_reservation(uuid, boolean) to service_role;

comment on function public.consume_text_pack_segments(uuid, integer) is
  'Debits prepaid text pack segments. Service role only. The balance trigger rejects a negative sum.';

comment on function public.refund_text_pack_segments(uuid, integer) is
  'Returns prepaid text pack segments when a send fails after a debit. Service role only.';

comment on function public.reserve_sms_segments(uuid, integer, text, integer, boolean) is
  'Reserves monthly SMS allowance and any pack remainder under one tenant lock. Service role only.';

comment on function public.release_sms_reservation(uuid, boolean) is
  'Releases an SMS allowance hold. Refunds pack segments when requested. Service role only.';
