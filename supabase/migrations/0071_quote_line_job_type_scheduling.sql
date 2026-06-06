-- =============================================================================
-- 0071_quote_line_job_type_scheduling.sql
-- Job type schedule roles, optional quote line display titles, and recurring
-- spacing settings for quote acceptance auto-scheduling.

create type public.service_template_schedule_role as enum ('initial', 'recurring', 'standard');

alter table public.tenant_service_templates
  add column if not exists schedule_role public.service_template_schedule_role not null default 'standard';

alter table public.tenant_quote_line_items
  add column if not exists display_title text;

alter table public.tenant_operational_settings
  add column if not exists recurring_starts_after_initial boolean not null default true,
  add column if not exists allow_same_day_initial_recurring boolean not null default false;

comment on column public.tenant_service_templates.schedule_role is
  'How auto-scheduling treats this job type: initial (first visit), recurring (ongoing cadence), or standard.';

comment on column public.tenant_quote_line_items.display_title is
  'Optional custom label on the quote; schedule uses the linked job type name when blank.';

comment on column public.tenant_operational_settings.recurring_starts_after_initial is
  'When true, the first recurring visit starts one full cadence after the last initial/one-time visit.';

update public.tenant_service_templates
set schedule_role = 'initial'::public.service_template_schedule_role
where is_system_default
  and name in ('Deep cleaning', 'Move-out deep clean', 'Initial / first clean');

update public.tenant_service_templates
set schedule_role = 'recurring'::public.service_template_schedule_role
where is_system_default
  and name = 'Standard cleaning';

-- Extend quote RPCs to persist display_title on line items.

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
      display_title,
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
      nullif(trim(rec.doc->>'display_title'), ''),
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
      display_title,
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
      nullif(trim(rec.doc->>'display_title'), ''),
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
