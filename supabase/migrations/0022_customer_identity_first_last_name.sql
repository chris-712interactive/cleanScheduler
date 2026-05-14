-- =============================================================================
-- 0022_customer_identity_first_last_name.sql
-- =============================================================================
-- Split display name into first + last for salutations (e.g. Resend templates).
-- `full_name` remains populated by the app for legacy list/search compatibility.

alter table public.customer_identities
  add column first_name text,
  add column last_name text;

comment on column public.customer_identities.first_name is
  'Given name; used for email salutations (e.g. portal invite template).';
comment on column public.customer_identities.last_name is
  'Family name (optional).';

-- Backfill from legacy full_name (first token + remainder after first space).
update public.customer_identities
set
  first_name = nullif(trim(split_part(btrim(coalesce(full_name, '')), ' ', 1)), ''),
  last_name = case
    when position(' ' in btrim(coalesce(full_name, ''))) = 0 then null
    else nullif(
      trim(substring(btrim(full_name) from position(' ' in btrim(full_name)) + 1)),
      ''
    )
  end
where full_name is not null
  and btrim(full_name) <> '';
