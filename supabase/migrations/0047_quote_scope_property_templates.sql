-- =============================================================================
-- 0047_quote_scope_property_templates.sql
-- Phase 2 quote create: property facts, structured scope, line pricing metadata,
-- tenant service template library, RPC + acceptance snapshot extensions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Property facts (persistent CRM)
-- -----------------------------------------------------------------------------

alter table public.tenant_customer_properties
  add column if not exists bedrooms smallint,
  add column if not exists bathrooms numeric(4, 1),
  add column if not exists sqft integer,
  add column if not exists stories smallint;

alter table public.tenant_customer_properties
  add constraint tenant_customer_properties_bedrooms_nonneg
    check (bedrooms is null or bedrooms >= 0),
  add constraint tenant_customer_properties_bathrooms_nonneg
    check (bathrooms is null or bathrooms >= 0),
  add constraint tenant_customer_properties_sqft_nonneg
    check (sqft is null or sqft >= 0),
  add constraint tenant_customer_properties_stories_nonneg
    check (stories is null or stories >= 0);

-- -----------------------------------------------------------------------------
-- Quote header: job type, structured scope/property, internal notes
-- -----------------------------------------------------------------------------

alter table public.tenant_quotes
  add column if not exists job_type public.customer_property_kind,
  add column if not exists scope_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists property_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists internal_notes text;

-- -----------------------------------------------------------------------------
-- Line item pricing metadata
-- -----------------------------------------------------------------------------

create type public.quote_line_pricing_method as enum (
  'flat',
  'hourly',
  'per_sqft'
);

alter table public.tenant_quote_line_items
  add column if not exists pricing_method public.quote_line_pricing_method not null default 'flat',
  add column if not exists estimated_hours numeric(6, 2);

alter table public.tenant_quote_line_items
  add constraint tenant_quote_line_items_estimated_hours_nonneg
    check (estimated_hours is null or estimated_hours >= 0);

-- -----------------------------------------------------------------------------
-- Tenant service template library (add-ons, scope templates, priced services)
-- -----------------------------------------------------------------------------

create type public.tenant_service_template_kind as enum (
  'service_line',
  'scope_template',
  'addon'
);

create table public.tenant_service_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.tenant_service_template_kind not null,
  name text not null,
  service_label text,
  amount_cents bigint,
  frequency public.quote_line_frequency,
  frequency_detail text,
  pricing_method public.quote_line_pricing_method not null default 'flat',
  estimated_hours numeric(6, 2),
  scope_template_id text,
  scope_inclusions jsonb not null default '[]'::jsonb,
  scope_exclusions text,
  job_type public.customer_property_kind,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_service_templates_amount_nonneg
    check (amount_cents is null or amount_cents >= 0),
  constraint tenant_service_templates_estimated_hours_nonneg
    check (estimated_hours is null or estimated_hours >= 0)
);

create index tenant_service_templates_tenant_kind_idx
  on public.tenant_service_templates (tenant_id, kind, sort_order);

create trigger tenant_service_templates_set_updated_at
before update on public.tenant_service_templates
for each row execute procedure public.set_updated_at();

alter table public.tenant_service_templates enable row level security;

create policy "tenant_service_templates_member_read"
  on public.tenant_service_templates
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_service_templates_member_write"
  on public.tenant_service_templates
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

grant select, insert, update, delete on table public.tenant_service_templates to service_role;

-- -----------------------------------------------------------------------------
-- Acceptance snapshot: persist structured quote fields + line pricing metadata
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
        'line_discount_value', li.line_discount_value,
        'pricing_method', li.pricing_method::text,
        'estimated_hours', li.estimated_hours
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

-- -----------------------------------------------------------------------------
-- RPC: create quote with line items (extended header + line metadata)
-- -----------------------------------------------------------------------------

drop function if exists public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
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
      estimated_hours
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
      nullif(rec.doc->>'estimated_hours', '')::numeric
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

-- -----------------------------------------------------------------------------
-- RPC: save quote with line items (extended header + line metadata)
-- -----------------------------------------------------------------------------

drop function if exists public.tenant_quote_save_with_line_items(
  uuid, uuid, text, public.quote_status, uuid, uuid, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
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
      estimated_hours
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
      nullif(rec.doc->>'estimated_hours', '')::numeric
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
