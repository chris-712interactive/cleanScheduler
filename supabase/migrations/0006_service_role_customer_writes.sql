-- Allow server-side tenant CRM (service role) to manage customer graph.

grant select, insert, update, delete on table public.customer_identities to service_role;
grant select, insert, update, delete on table public.customer_tenant_links to service_role;

grant insert, update, delete on table public.customers to service_role;
