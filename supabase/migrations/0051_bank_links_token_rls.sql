-- Restrict plaid_access_token from authenticated member SELECT; expose safe view without token.

create or replace view public.bank_links_member_safe
with (security_invoker = true) as
select
  id,
  tenant_id,
  plaid_item_id,
  plaid_institution_id,
  institution_name,
  plaid_account_id,
  account_name,
  account_mask,
  account_type,
  account_subtype,
  transactions_cursor,
  status,
  last_synced_at,
  last_sync_error,
  created_at,
  updated_at
from public.bank_links;

comment on view public.bank_links_member_safe is
  'Tenant-safe bank_links projection without plaid_access_token.';

revoke all on table public.bank_links from authenticated;
grant select on table public.bank_links_member_safe to authenticated;

-- Service role retains full table access for server-side Plaid sync.
