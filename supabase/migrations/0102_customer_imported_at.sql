-- Marks customers created by a tenant customer-list import so the new-quote
-- picker can offer them without a completed consultation form.

alter table public.customers
  add column if not exists imported_at timestamptz;

comment on column public.customers.imported_at is
  'When this customer was created by a tenant customer-list import. Null for customers added any other way.';

update public.customers
set imported_at = created_at
where imported_at is null
  and external_ref is not null;
