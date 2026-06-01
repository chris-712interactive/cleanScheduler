-- =============================================================================
-- 0057_owner_first_last_name.sql
-- =============================================================================
-- Store owner first + last name for email salutations; keep owner_name as full name.

alter table public.tenant_onboarding_profiles
  add column owner_first_name text,
  add column owner_last_name text;

alter table public.user_profiles
  add column first_name text,
  add column last_name text;

comment on column public.tenant_onboarding_profiles.owner_first_name is
  'Owner given name; used for transactional email salutations (Hi {{first}}).';
comment on column public.tenant_onboarding_profiles.owner_last_name is
  'Owner family name (optional).';
comment on column public.user_profiles.first_name is
  'Given name; used for email salutations and display when set.';
comment on column public.user_profiles.last_name is
  'Family name (optional).';

update public.tenant_onboarding_profiles
set
  owner_first_name = nullif(trim(split_part(btrim(coalesce(owner_name, '')), ' ', 1)), ''),
  owner_last_name = case
    when position(' ' in btrim(coalesce(owner_name, ''))) = 0 then null
    else nullif(
      trim(substring(btrim(owner_name) from position(' ' in btrim(owner_name)) + 1)),
      ''
    )
  end
where owner_name is not null
  and btrim(owner_name) <> '';

update public.user_profiles
set
  first_name = nullif(trim(split_part(btrim(coalesce(display_name, '')), ' ', 1)), ''),
  last_name = case
    when position(' ' in btrim(coalesce(display_name, ''))) = 0 then null
    else nullif(
      trim(substring(btrim(display_name) from position(' ' in btrim(display_name)) + 1)),
      ''
    )
  end
where display_name is not null
  and btrim(display_name) <> '';
