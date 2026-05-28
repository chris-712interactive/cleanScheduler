-- Hourly batch: sent quotes past valid_until -> expired (see 0020).
-- Supabase: https://supabase.com/docs/guides/cron/install

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Job runs as postgres; explicit grant keeps behavior clear if privileges tighten.
grant execute on function public.expire_sent_quotes_past_valid_until() to postgres;

select cron.unschedule(j.jobid)
from cron.job j
where j.jobname = 'expire_sent_quotes_past_valid_until';

select cron.schedule(
  'expire_sent_quotes_past_valid_until',
  '0 * * * *',
  $$select public.expire_sent_quotes_past_valid_until();$$
);
