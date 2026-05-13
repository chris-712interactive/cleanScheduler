-- =============================================================================
-- 0017_quote_acceptance_versioning.sql
-- =============================================================================
-- Acceptance: immutable snapshot + lock. Versioning: quote_group_id chain,
-- version_reason on amendments. Transactional line-item replace RPC.
-- See docs/product/quotes-line-items.md.

-- -----------------------------------------------------------------------------
-- tenant_quotes: versioning + acceptance metadata
-- -----------------------------------------------------------------------------

alter table public.tenant_quotes
  add column if not exists quote_group_id uuid,
  add column if not exists version_number int not null default 1,
  add column if not exists version_reason text,
  add column if not exists supersedes_quote_id uuid references public.tenant_quotes(id) on delete set null,
  add column if not exists superseded_by_quote_id uuid references public.tenant_quotes(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists is_locked boolean not null default false;

update public.tenant_quotes
set
  quote_group_id = id,
  version_number = 1
where quote_group_id is null;

alter table public.tenant_quotes
  alter column quote_group_id set not null;

create index if not exists tenant_quotes_quote_group_version_idx
  on public.tenant_quotes (quote_group_id, version_number);

-- Existing accepted quotes: lock + accepted_at backfill (no snapshot yet)
update public.tenant_quotes
set
  is_locked = true,
  accepted_at = coalesce(accepted_at, updated_at, created_at)
where status = 'accepted'
  and not is_locked;

-- -----------------------------------------------------------------------------
-- Acceptance snapshot (one row per quote at first transition to accepted)
-- -----------------------------------------------------------------------------

create table public.tenant_quote_acceptance_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.tenant_quotes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  captured_at timestamptz not null default now(),
  payload jsonb not null,
  constraint tenant_quote_acceptance_snapshots_quote_unique unique (quote_id)
);

create index tenant_quote_acceptance_snapshots_tenant_idx
  on public.tenant_quote_acceptance_snapshots (tenant_id);

create or replace function public.tenant_quote_acceptance_snapshots_fill_tenant()
returns trigger
language plpgsql
as $$
declare
  tid uuid;
begin
  select q.tenant_id into tid from public.tenant_quotes q where q.id = new.quote_id;
  if tid is null then
    raise exception 'tenant_quote_acceptance_snapshots: quote not found';
  end if;
  new.tenant_id := tid;
  return new;
end;
$$;

create trigger tenant_quote_acceptance_snapshots_fill_tenant
before insert on public.tenant_quote_acceptance_snapshots
for each row execute procedure public.tenant_quote_acceptance_snapshots_fill_tenant();

alter table public.tenant_quote_acceptance_snapshots enable row level security;

create policy "tenant_quote_acceptance_snapshots_member_read"
  on public.tenant_quote_acceptance_snapshots
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_quote_acceptance_snapshots_member_write"
  on public.tenant_quote_acceptance_snapshots
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

revoke all on table public.tenant_quote_acceptance_snapshots from anon;
revoke all on table public.tenant_quote_acceptance_snapshots from authenticated;
grant select, insert, update, delete on table public.tenant_quote_acceptance_snapshots to service_role;

-- -----------------------------------------------------------------------------
-- BEFORE INSERT: default quote_group_id to id when not supplied (new quote)
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quotes_set_default_quote_group()
returns trigger
language plpgsql
as $$
begin
  if new.quote_group_id is null then
    new.quote_group_id := new.id;
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_03_default_quote_group
before insert on public.tenant_quotes
for each row execute procedure public.tenant_quotes_set_default_quote_group();

-- -----------------------------------------------------------------------------
-- BEFORE INSERT/UPDATE OF status: lock + accepted_at on first acceptance
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quotes_set_acceptance_lock()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'accepted'::public.quote_status)
     or (
       tg_op = 'UPDATE'
       and new.status = 'accepted'::public.quote_status
       and old.status is distinct from 'accepted'::public.quote_status
     ) then
    new.is_locked := true;
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_04_acceptance_lock
before insert or update of status on public.tenant_quotes
for each row execute procedure public.tenant_quotes_set_acceptance_lock();

-- -----------------------------------------------------------------------------
-- AFTER INSERT/UPDATE OF status: persist frozen JSON snapshot once
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quote_acceptance_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lines jsonb;
  should_snap boolean;
begin
  should_snap := (tg_op = 'INSERT' and new.status = 'accepted'::public.quote_status)
    or (
      tg_op = 'UPDATE'
      and new.status = 'accepted'::public.quote_status
      and old.status is distinct from 'accepted'::public.quote_status
    );

  if not should_snap then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sort_order', li.sort_order,
        'service_label', li.service_label,
        'frequency', li.frequency::text,
        'frequency_detail', li.frequency_detail,
        'amount_cents', li.amount_cents
      )
      order by li.sort_order
    ),
    '[]'::jsonb
  )
  into lines
  from public.tenant_quote_line_items li
  where li.quote_id = new.id;

  insert into public.tenant_quote_acceptance_snapshots (quote_id, tenant_id, payload)
  values (
    new.id,
    new.tenant_id,
    jsonb_build_object(
      'title', new.title,
      'status', new.status::text,
      'amount_cents', new.amount_cents,
      'currency', new.currency,
      'notes', new.notes,
      'valid_until', new.valid_until,
      'customer_id', new.customer_id,
      'property_id', new.property_id,
      'line_items', lines
    )
  )
  on conflict (quote_id) do nothing;

  return null;
end;
$$;

create trigger tenant_quotes_05_acceptance_snapshot
after insert or update of status on public.tenant_quotes
for each row execute procedure public.tenant_quote_acceptance_snapshot_fn();

-- Backfill snapshots for quotes already accepted before this migration
insert into public.tenant_quote_acceptance_snapshots (quote_id, tenant_id, payload)
select
  q.id,
  q.tenant_id,
  jsonb_build_object(
    'title', q.title,
    'status', q.status::text,
    'amount_cents', q.amount_cents,
    'currency', q.currency,
    'notes', q.notes,
    'valid_until', q.valid_until,
    'customer_id', q.customer_id,
    'property_id', q.property_id,
    'line_items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'sort_order', li.sort_order,
            'service_label', li.service_label,
            'frequency', li.frequency::text,
            'frequency_detail', li.frequency_detail,
            'amount_cents', li.amount_cents
          )
          order by li.sort_order
        )
        from public.tenant_quote_line_items li
        where li.quote_id = q.id
      ),
      '[]'::jsonb
    )
  )
from public.tenant_quotes q
where q.status = 'accepted'::public.quote_status
  and not exists (
    select 1
    from public.tenant_quote_acceptance_snapshots s
    where s.quote_id = q.id
  );

-- -----------------------------------------------------------------------------
-- RPC: replace line items + update header in one transaction (unlocked quotes)
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quote_save_with_line_items(
  p_quote_id uuid,
  p_tenant_id uuid,
  p_title text,
  p_status public.quote_status,
  p_customer_id uuid,
  p_property_id uuid,
  p_amount_cents bigint,
  p_notes text,
  p_valid_until timestamptz,
  p_line_items jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  ord int := 0;
begin
  if exists (
    select 1
    from public.tenant_quotes q
    where q.id = p_quote_id
      and q.tenant_id = p_tenant_id
      and q.is_locked
  ) then
    raise exception 'QUOTE_LOCKED';
  end if;

  if not exists (
    select 1 from public.tenant_quotes q where q.id = p_quote_id and q.tenant_id = p_tenant_id
  ) then
    raise exception 'QUOTE_NOT_FOUND';
  end if;

  delete from public.tenant_quote_line_items where quote_id = p_quote_id;

  for rec in
    select t.value as doc
    from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) as t(value)
  loop
    insert into public.tenant_quote_line_items (
      quote_id,
      sort_order,
      service_label,
      frequency,
      frequency_detail,
      amount_cents
    )
    values (
      p_quote_id,
      coalesce((rec.doc->>'sort_order')::int, ord),
      trim(rec.doc->>'service_label'),
      coalesce(
        (rec.doc->>'frequency')::public.quote_line_frequency,
        'one_time'::public.quote_line_frequency
      ),
      nullif(trim(rec.doc->>'frequency_detail'), ''),
      (rec.doc->>'amount_cents')::bigint
    );
    ord := ord + 1;
  end loop;

  update public.tenant_quotes
  set
    title = p_title,
    status = p_status,
    customer_id = p_customer_id,
    property_id = p_property_id,
    amount_cents = p_amount_cents,
    notes = p_notes,
    valid_until = p_valid_until
  where id = p_quote_id
    and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz, jsonb
) from public;
grant execute on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz, jsonb
) to service_role;
