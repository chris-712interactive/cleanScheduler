-- Let the office quotes board hear when a customer accepts, declines, or a quote expires.
-- Full replica identity so the live payload includes status and pipeline stage.

alter table public.tenant_quotes replica identity full;

grant select on table public.tenant_quotes to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'tenant_quotes'
     ) then
    alter publication supabase_realtime add table public.tenant_quotes;
  end if;
end $$;
