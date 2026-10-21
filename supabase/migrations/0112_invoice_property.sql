-- An invoice belongs to the service location it bills, not only the customer.
-- Visit completion and quote prepay copy that location. A customer with one
-- property gets that property. Existing rows are filled the same way.

alter table public.tenant_invoices
  add column if not exists property_id uuid null references public.tenant_customer_properties (id) on delete set null;

create index if not exists tenant_invoices_property_idx
  on public.tenant_invoices (tenant_id, property_id)
  where property_id is not null;

comment on column public.tenant_invoices.property_id is
  'Service location this invoice bills. Copied from the visit or quote, or the customer''s only property.';

create or replace function public.tenant_invoices_assign_property()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved uuid;
  owner_customer uuid;
  owner_tenant uuid;
begin
  if new.property_id is null and new.visit_id is not null then
    select coalesce(v.property_id, q.property_id)
      into resolved
    from public.tenant_scheduled_visits v
    left join public.tenant_quotes q
      on q.id = v.quote_id
     and q.tenant_id = v.tenant_id
     and q.customer_id = v.customer_id
    where v.id = new.visit_id
      and v.tenant_id = new.tenant_id
      and v.customer_id = new.customer_id;
    new.property_id := resolved;
  end if;

  if new.property_id is null and new.quote_id is not null then
    select q.property_id
      into new.property_id
    from public.tenant_quotes q
    where q.id = new.quote_id
      and q.tenant_id = new.tenant_id
      and q.customer_id = new.customer_id;
  end if;

  if new.property_id is null and new.id is not null then
    select coalesce(v.property_id, q.property_id)
      into resolved
    from public.tenant_scheduled_visits v
    left join public.tenant_quotes q
      on q.id = v.quote_id
     and q.tenant_id = v.tenant_id
     and q.customer_id = v.customer_id
    where v.completion_invoice_id = new.id
      and v.tenant_id = new.tenant_id
      and v.customer_id = new.customer_id
    limit 1;
    new.property_id := resolved;
  end if;

  if new.property_id is null then
    select case when count(*) = 1 then min(p.id) else null end
      into new.property_id
    from public.tenant_customer_properties p
    where p.tenant_id = new.tenant_id
      and p.customer_id = new.customer_id;
  end if;

  if new.property_id is not null then
    select p.customer_id, p.tenant_id
      into owner_customer, owner_tenant
    from public.tenant_customer_properties p
    where p.id = new.property_id;

    if owner_customer is null
       or owner_customer <> new.customer_id
       or owner_tenant <> new.tenant_id then
      new.property_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_invoices_assign_property on public.tenant_invoices;

create trigger tenant_invoices_assign_property
before insert or update on public.tenant_invoices
for each row
execute procedure public.tenant_invoices_assign_property();

update public.tenant_invoices
set updated_at = updated_at
where property_id is null;
