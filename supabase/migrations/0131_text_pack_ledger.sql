-- Prepaid text packs. Segments carry over until used. They are not a monthly plan.
-- Tenant members can read their own rows. Credits are written by the service role
-- (Stripe webhook) and by consume_text_pack_segments / refund_text_pack_segments.
-- Authenticated clients have no insert or update grant.

create table public.tenant_text_pack_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  segments integer not null check (segments <> 0),
  kind text not null check (kind in ('purchase', 'use', 'refund')),
  stripe_checkout_session_id text,
  pack_key text,
  amount_cents integer,
  created_at timestamptz not null default now(),
  constraint tenant_text_pack_ledger_pack_key_check check (
    pack_key is null or pack_key in ('pack_1000', 'pack_2500')
  ),
  constraint tenant_text_pack_ledger_amount_check check (
    amount_cents is null or amount_cents > 0
  ),
  constraint tenant_text_pack_ledger_shape_check check (
    (
      kind = 'purchase'
      and segments > 0
      and stripe_checkout_session_id is not null
      and pack_key is not null
      and amount_cents is not null
    )
    or (
      kind = 'use'
      and segments < 0
      and stripe_checkout_session_id is null
      and pack_key is null
      and amount_cents is null
    )
    or (
      kind = 'refund'
      and segments > 0
      and stripe_checkout_session_id is null
      and pack_key is null
      and amount_cents is null
    )
  )
);

create unique index tenant_text_pack_ledger_session_uidx
  on public.tenant_text_pack_ledger (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index tenant_text_pack_ledger_tenant_idx
  on public.tenant_text_pack_ledger (tenant_id, created_at desc);

comment on table public.tenant_text_pack_ledger is
  'Prepaid text pack segments for one tenant. Purchases are positive and do not expire monthly. Use rows are negative and are written only after the plan allowance is exhausted.';

alter table public.tenant_text_pack_ledger enable row level security;
alter table public.tenant_text_pack_ledger force row level security;

revoke all on table public.tenant_text_pack_ledger from public;
revoke all on table public.tenant_text_pack_ledger from anon;
revoke all on table public.tenant_text_pack_ledger from authenticated;
grant select on table public.tenant_text_pack_ledger to authenticated;
grant select, insert, update, delete on table public.tenant_text_pack_ledger to service_role;

create policy tenant_text_pack_ledger_member_read
  on public.tenant_text_pack_ledger
  for select
  to authenticated
  using (public.has_tenant_membership(tenant_id));

create or replace function public.consume_text_pack_segments(p_tenant uuid, p_segments integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  available integer;
begin
  if p_tenant is null or p_segments is null or p_segments <= 0 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  select coalesce(sum(segments), 0)
    into available
  from public.tenant_text_pack_ledger
  where tenant_id = p_tenant;

  if available < p_segments then
    return false;
  end if;

  insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
  values (p_tenant, -p_segments, 'use');

  return true;
end;
$$;

create or replace function public.refund_text_pack_segments(p_tenant uuid, p_segments integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant is null or p_segments is null or p_segments <= 0 then
    return;
  end if;

  insert into public.tenant_text_pack_ledger (tenant_id, segments, kind)
  values (p_tenant, p_segments, 'refund');
end;
$$;

revoke all on function public.consume_text_pack_segments(uuid, integer) from public;
revoke all on function public.consume_text_pack_segments(uuid, integer) from anon;
revoke all on function public.consume_text_pack_segments(uuid, integer) from authenticated;
grant execute on function public.consume_text_pack_segments(uuid, integer) to service_role;

revoke all on function public.refund_text_pack_segments(uuid, integer) from public;
revoke all on function public.refund_text_pack_segments(uuid, integer) from anon;
revoke all on function public.refund_text_pack_segments(uuid, integer) from authenticated;
grant execute on function public.refund_text_pack_segments(uuid, integer) to service_role;

comment on function public.consume_text_pack_segments(uuid, integer) is
  'Debits prepaid text pack segments when the monthly allowance is already used. Service role only.';

comment on function public.refund_text_pack_segments(uuid, integer) is
  'Returns prepaid text pack segments when a send fails after a debit. Service role only.';
