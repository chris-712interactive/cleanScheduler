-- =============================================================================
-- 0058_quote_line_auto_schedule.sql
-- Per-line auto-schedule flags, visit linkage, and RPC updates.
-- =============================================================================

alter table public.tenant_quote_line_items
  add column if not exists auto_schedule_on_accept boolean not null default false,
  add column if not exists auto_schedule_visit_count int;

alter table public.tenant_quote_line_items
  drop constraint if exists tenant_quote_line_items_auto_schedule_visit_count_range;

alter table public.tenant_quote_line_items
  add constraint tenant_quote_line_items_auto_schedule_visit_count_range
  check (
    auto_schedule_visit_count is null
    or (auto_schedule_visit_count >= 1 and auto_schedule_visit_count <= 52)
  );

comment on column public.tenant_quote_line_items.auto_schedule_on_accept is
  'When tenant operational mode is auto_schedule, create visits for this line on quote accept.';

comment on column public.tenant_quote_line_items.auto_schedule_visit_count is
  'How many visits to materialize for recurring lines (ignored for one_time — always 1).';

alter table public.tenant_scheduled_visits
  add column if not exists quote_line_item_id uuid references public.tenant_quote_line_items (id) on delete set null,
  add column if not exists auto_schedule_sequence smallint;

alter table public.tenant_scheduled_visits
  drop constraint if exists tenant_scheduled_visits_auto_schedule_sequence_range;

alter table public.tenant_scheduled_visits
  add constraint tenant_scheduled_visits_auto_schedule_sequence_range
  check (
    auto_schedule_sequence is null
    or (auto_schedule_sequence >= 1 and auto_schedule_sequence <= 52)
  );

create unique index if not exists tenant_scheduled_visits_auto_schedule_uidx
  on public.tenant_scheduled_visits (quote_line_item_id, auto_schedule_sequence)
  where quote_line_item_id is not null and auto_schedule_sequence is not null;

create index if not exists tenant_scheduled_visits_quote_line_item_idx
  on public.tenant_scheduled_visits (quote_id, quote_line_item_id);

-- Acceptance snapshot includes auto-schedule metadata on line items.
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
        'line_discount_value', li.line_discount_value,
        'pricing_method', li.pricing_method::text,
        'estimated_hours', li.estimated_hours,
        'auto_schedule_on_accept', li.auto_schedule_on_accept,
        'auto_schedule_visit_count', li.auto_schedule_visit_count
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
      'internal_notes', new.internal_notes,
      'valid_until', new.valid_until,
      'customer_id', new.customer_id,
      'property_id', new.property_id,
      'job_type', new.job_type::text,
      'scope_snapshot', new.scope_snapshot,
      'property_snapshot', new.property_snapshot,
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

drop function if exists public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
);

create or replace function public.tenant_quote_create_with_line_items(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_title text,
  p_status public.quote_status,
  p_amount_cents bigint,
  p_notes text,
  p_valid_until timestamptz,
  p_tax_mode public.quote_tax_mode,
  p_tax_rate_bps int,
  p_quote_discount_kind public.quote_discount_kind,
  p_quote_discount_value bigint,
  p_line_items jsonb,
  p_job_type public.customer_property_kind default null,
  p_scope_snapshot jsonb default '{}'::jsonb,
  p_property_snapshot jsonb default '{}'::jsonb,
  p_internal_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  rec record;
  ord int := 0;
begin
  if not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'CUSTOMER_NOT_IN_TENANT';
  end if;

  if p_property_id is not null then
    if not exists (
      select 1
      from public.tenant_customer_properties p
      where p.id = p_property_id
        and p.tenant_id = p_tenant_id
        and p.customer_id = p_customer_id
    ) then
      raise exception 'PROPERTY_NOT_FOR_CUSTOMER';
    end if;
  end if;

  insert into public.tenant_quotes (
    tenant_id,
    customer_id,
    property_id,
    title,
    status,
    amount_cents,
    notes,
    valid_until,
    tax_mode,
    tax_rate_bps,
    quote_discount_kind,
    quote_discount_value,
    job_type,
    scope_snapshot,
    property_snapshot,
    internal_notes
  )
  values (
    p_tenant_id,
    p_customer_id,
    p_property_id,
    p_title,
    p_status,
    p_amount_cents,
    p_notes,
    p_valid_until,
    p_tax_mode,
    p_tax_rate_bps,
    p_quote_discount_kind,
    p_quote_discount_value,
    p_job_type,
    coalesce(p_scope_snapshot, '{}'::jsonb),
    coalesce(p_property_snapshot, '{}'::jsonb),
    nullif(trim(p_internal_notes), '')
  )
  returning id into new_id;

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
      line_discount_value,
      pricing_method,
      estimated_hours,
      auto_schedule_on_accept,
      auto_schedule_visit_count
    )
    values (
      new_id,
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
      coalesce((rec.doc->>'line_discount_value')::bigint, 0),
      coalesce(
        (rec.doc->>'pricing_method')::public.quote_line_pricing_method,
        'flat'::public.quote_line_pricing_method
      ),
      nullif(rec.doc->>'estimated_hours', '')::numeric,
      coalesce((rec.doc->>'auto_schedule_on_accept')::boolean, false),
      nullif(rec.doc->>'auto_schedule_visit_count', '')::int
    );
    ord := ord + 1;
  end loop;

  return new_id;
end;
$$;

revoke all on function public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
) from public;
grant execute on function public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
) to service_role;

drop function if exists public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
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
  p_line_items jsonb,
  p_job_type public.customer_property_kind default null,
  p_scope_snapshot jsonb default '{}'::jsonb,
  p_property_snapshot jsonb default '{}'::jsonb,
  p_internal_notes text default null
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
      line_discount_value,
      pricing_method,
      estimated_hours,
      auto_schedule_on_accept,
      auto_schedule_visit_count
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
      coalesce((rec.doc->>'line_discount_value')::bigint, 0),
      coalesce(
        (rec.doc->>'pricing_method')::public.quote_line_pricing_method,
        'flat'::public.quote_line_pricing_method
      ),
      nullif(rec.doc->>'estimated_hours', '')::numeric,
      coalesce((rec.doc->>'auto_schedule_on_accept')::boolean, false),
      nullif(rec.doc->>'auto_schedule_visit_count', '')::int
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
    quote_discount_value = p_quote_discount_value,
    job_type = p_job_type,
    scope_snapshot = coalesce(p_scope_snapshot, '{}'::jsonb),
    property_snapshot = coalesce(p_property_snapshot, '{}'::jsonb),
    internal_notes = nullif(trim(p_internal_notes), '')
  where id = p_quote_id
    and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
) from public;
grant execute on function public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb,
  public.customer_property_kind, jsonb, jsonb, text
) to service_role;
