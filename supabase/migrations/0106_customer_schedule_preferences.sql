-- Generic days and time of day a customer prefers, used when a period is filled.

alter table public.tenant_customer_scheduling_preferences
  add column if not exists preferred_weekdays text[] not null default '{}',
  add column if not exists preferred_time_window text;

alter table public.tenant_customer_scheduling_preferences
  drop constraint if exists tenant_customer_scheduling_prefs_weekdays_check;

alter table public.tenant_customer_scheduling_preferences
  add constraint tenant_customer_scheduling_prefs_weekdays_check
  check (
    preferred_weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  );

alter table public.tenant_customer_scheduling_preferences
  drop constraint if exists tenant_customer_scheduling_prefs_time_window_check;

alter table public.tenant_customer_scheduling_preferences
  add constraint tenant_customer_scheduling_prefs_time_window_check
  check (
    preferred_time_window is null
    or preferred_time_window in ('morning', 'afternoon', 'evening')
  );

comment on column public.tenant_customer_scheduling_preferences.preferred_weekdays is
  'Weekdays the customer prefers. Empty means any day the business is open.';

comment on column public.tenant_customer_scheduling_preferences.preferred_time_window is
  'Morning, afternoon, or evening. A specific arrival window replaces this.';
