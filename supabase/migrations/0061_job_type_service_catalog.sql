-- =============================================================================
-- 0061_job_type_service_catalog.sql
-- Job type catalog defaults, quote line template link, RPC updates.
-- =============================================================================

alter table public.tenant_service_templates
  add column if not exists is_system_default boolean not null default false;

comment on column public.tenant_service_templates.is_system_default is
  'True for platform-seeded job types; Pro tenants may add custom rows with is_system_default = false.';

alter table public.tenant_quote_line_items
  add column if not exists service_template_id uuid references public.tenant_service_templates (id) on delete set null;

create index if not exists tenant_quote_line_items_service_template_idx
  on public.tenant_quote_line_items (service_template_id)
  where service_template_id is not null;

create unique index if not exists tenant_service_templates_service_line_uidx
  on public.tenant_service_templates (
    tenant_id,
    lower(trim(service_label)),
    job_type
  )
  where kind = 'service_line'::public.tenant_service_template_kind
    and job_type is not null
    and is_active = true;

-- Seed default job types for tenants that have none yet.
insert into public.tenant_service_templates (
  tenant_id,
  kind,
  name,
  service_label,
  job_type,
  estimated_hours,
  is_system_default,
  is_active,
  sort_order
)
select
  t.id,
  'service_line'::public.tenant_service_template_kind,
  seed.name,
  seed.service_label,
  seed.job_type,
  seed.estimated_hours,
  true,
  true,
  seed.sort_order
from public.tenants t
cross join (
  values
    ('Deep cleaning', 'Deep cleaning', 'residential'::public.customer_property_kind, 4.0, 0),
    ('Deep cleaning', 'Deep cleaning', 'commercial'::public.customer_property_kind, 6.0, 0),
    ('Deep cleaning', 'Deep cleaning', 'short_term_rental'::public.customer_property_kind, 3.0, 0),
    ('Deep cleaning', 'Deep cleaning', 'other'::public.customer_property_kind, 4.0, 0),
    ('Standard cleaning', 'Standard cleaning', 'residential'::public.customer_property_kind, 2.0, 1),
    ('Standard cleaning', 'Standard cleaning', 'commercial'::public.customer_property_kind, 3.0, 1),
    ('Standard cleaning', 'Standard cleaning', 'short_term_rental'::public.customer_property_kind, 2.0, 1),
    ('Standard cleaning', 'Standard cleaning', 'other'::public.customer_property_kind, 2.0, 1),
    ('Move-out deep clean', 'Move-out deep clean', 'residential'::public.customer_property_kind, 5.0, 2),
    ('Move-out deep clean', 'Move-out deep clean', 'commercial'::public.customer_property_kind, 8.0, 2),
    ('Move-out deep clean', 'Move-out deep clean', 'short_term_rental'::public.customer_property_kind, 4.0, 2),
    ('Move-out deep clean', 'Move-out deep clean', 'other'::public.customer_property_kind, 5.0, 2),
    ('Initial / first clean', 'Initial / first clean', 'residential'::public.customer_property_kind, 3.0, 3),
    ('Initial / first clean', 'Initial / first clean', 'commercial'::public.customer_property_kind, 4.0, 3),
    ('Initial / first clean', 'Initial / first clean', 'short_term_rental'::public.customer_property_kind, 3.0, 3),
    ('Initial / first clean', 'Initial / first clean', 'other'::public.customer_property_kind, 3.0, 3)
) as seed(name, service_label, job_type, estimated_hours, sort_order)
where not exists (
  select 1
  from public.tenant_service_templates st
  where st.tenant_id = t.id
    and st.kind = 'service_line'::public.tenant_service_template_kind
);

-- Quote RPCs: persist service_template_id on line items.
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
  p_scope_snapshot jsonb default null,
  p_property_snapshot jsonb default null,
  p_internal_notes text default null
)
returns uuid
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
    raise exception 'CUSTOMER_NOT_FOUND';
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
      auto_schedule_visit_count,
      service_template_id
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
      nullif(rec.doc->>'auto_schedule_visit_count', '')::int,
      nullif(rec.doc->>'service_template_id', '')::uuid
    );
    ord := ord + 1;
  end loop;

  return new_id;
end;
$$;

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
  p_scope_snapshot jsonb default null,
  p_property_snapshot jsonb default null,
  p_internal_notes text default null
)
returns void
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
      auto_schedule_visit_count,
      service_template_id
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
      nullif(rec.doc->>'auto_schedule_visit_count', '')::int,
      nullif(rec.doc->>'service_template_id', '')::uuid
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
