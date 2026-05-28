-- =============================================================================
-- 0019_quote_tax_discount.sql
-- =============================================================================
-- Per-quote tax (exclusive add-on) and quote-level + per-line discounts.
-- Percent values are stored in basis points (10000 = 100%). Replaces RPC and
-- acceptance snapshot function to persist new fields. See docs/product/quotes-line-items.md.

create type public.quote_tax_mode as enum (
  'none',
  'exclusive'
);

create type public.quote_discount_kind as enum (
  'none',
  'percent',
  'fixed_cents'
);

create type public.quote_line_discount_kind as enum (
  'none',
  'percent',
  'fixed_cents'
);

alter table public.tenant_quotes
  add column if not exists tax_mode public.quote_tax_mode not null default 'none'::public.quote_tax_mode,
  add column if not exists tax_rate_bps int not null default 0,
  add column if not exists quote_discount_kind public.quote_discount_kind not null default 'none'::public.quote_discount_kind,
  add column if not exists quote_discount_value bigint not null default 0,
  add constraint tenant_quotes_tax_rate_bps_range check (tax_rate_bps >= 0 and tax_rate_bps <= 1000000),
  add constraint tenant_quotes_quote_discount_value_non_negative check (quote_discount_value >= 0);

alter table public.tenant_quote_line_items
  add column if not exists line_discount_kind public.quote_line_discount_kind not null default 'none'::public.quote_line_discount_kind,
  add column if not exists line_discount_value bigint not null default 0,
  add constraint tenant_quote_line_items_line_discount_value_non_negative check (line_discount_value >= 0);

-- -----------------------------------------------------------------------------
-- Acceptance snapshot: include tax/discount + line-level discount fields
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
        'amount_cents', li.amount_cents,
        'line_discount_kind', li.line_discount_kind::text,
        'line_discount_value', li.line_discount_value
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
      'tax_mode', new.tax_mode::text,
      'tax_rate_bps', new.tax_rate_bps,
      'quote_discount_kind', new.quote_discount_kind::text,
      'quote_discount_value', new.quote_discount_value,
      'line_items', lines
    )
  )
  on conflict (quote_id) do nothing;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: replace line items + update header (includes tax/discount columns)
-- -----------------------------------------------------------------------------

drop function if exists public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz, jsonb
);

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
  p_tax_mode public.quote_tax_mode,
  p_tax_rate_bps int,
  p_quote_discount_kind public.quote_discount_kind,
  p_quote_discount_value bigint,
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
      amount_cents,
      line_discount_kind,
      line_discount_value
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
      (rec.doc->>'amount_cents')::bigint,
      coalesce(
        (rec.doc->>'line_discount_kind')::public.quote_line_discount_kind,
        'none'::public.quote_line_discount_kind
      ),
      coalesce((rec.doc->>'line_discount_value')::bigint, 0)
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
    valid_until = p_valid_until,
    tax_mode = p_tax_mode,
    tax_rate_bps = p_tax_rate_bps,
    quote_discount_kind = p_quote_discount_kind,
    quote_discount_value = p_quote_discount_value
  where id = p_quote_id
    and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz, public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
) from public;
grant execute on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz, public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
) to service_role;
