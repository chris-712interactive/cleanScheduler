-- Allow server-side founder aggregates (service role) to count customer rows.

grant select on table public.customers to service_role;
