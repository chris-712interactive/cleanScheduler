-- Apply a suggested multi-cleaner dispatch in one transaction.
-- The office calls this with the service role after checking the signed-in role.
-- Authenticated and anon cannot execute it. Existing visit and assignee policies
-- are unchanged. Apply this file by hand on each Supabase project after review.
-- Do not apply it to the shared dev project or to production from an agent.

create or replace function public.apply_cleaner_dispatch(
  p_tenant_id uuid,
  p_snapshot jsonb,
  p_plan jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  v_visit_id uuid;
  current_assignees uuid[];
  expected_assignees uuid[];
  next_assignees uuid[];
  v_assignee uuid;
  change_assignees boolean;
  next_sequence integer;
  matched integer;
begin
  if p_tenant_id is null
     or jsonb_typeof(p_snapshot) is distinct from 'array'
     or jsonb_typeof(p_plan) is distinct from 'array' then
    raise exception 'invalid_dispatch';
  end if;

  perform 1
  from public.tenant_scheduled_visits v
  where v.tenant_id = p_tenant_id
    and v.id in (
      select (value->>'id')::uuid
      from jsonb_array_elements(p_snapshot)
    )
  for update;

  select count(*)
    into matched
  from public.tenant_scheduled_visits v
  where v.tenant_id = p_tenant_id
    and v.id in (
      select (value->>'id')::uuid
      from jsonb_array_elements(p_snapshot)
    );

  if matched is distinct from jsonb_array_length(p_snapshot) then
    raise exception 'stale_dispatch';
  end if;

  for item in select value from jsonb_array_elements(p_snapshot)
  loop
    v_visit_id := (item->>'id')::uuid;

    select coalesce(array_agg(a.user_id order by a.user_id), '{}'::uuid[])
      into current_assignees
    from public.tenant_scheduled_visit_assignees a
    where a.visit_id = v_visit_id;

    select coalesce(array_agg(x.value::uuid order by x.value::uuid), '{}'::uuid[])
      into expected_assignees
    from jsonb_array_elements_text(coalesce(item->'assigneeIds', '[]'::jsonb)) as x(value);

    if not exists (
      select 1
      from public.tenant_scheduled_visits v
      where v.id = v_visit_id
        and v.tenant_id = p_tenant_id
        and v.starts_at = (item->>'startsAt')::timestamptz
        and v.ends_at = (item->>'endsAt')::timestamptz
        and v.status::text = item->>'status'
        and v.checked_in_at is not distinct from nullif(item->>'checkedInAt', '')::timestamptz
        and v.route_sequence is not distinct from nullif(item->>'routeSequence', '')::integer
        and v.updated_at = (item->>'updatedAt')::timestamptz
        and current_assignees = expected_assignees
    ) then
      raise exception 'stale_dispatch';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_plan)
  loop
    v_visit_id := (item->>'id')::uuid;
    next_assignees := '{}'::uuid[];

    if not exists (
      select 1
      from public.tenant_scheduled_visits v
      where v.id = v_visit_id
        and v.tenant_id = p_tenant_id
    ) then
      raise exception 'tenant_mismatch';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(p_snapshot) as snap(value)
      where (snap.value->>'id')::uuid = v_visit_id
    ) then
      raise exception 'tenant_mismatch';
    end if;

    change_assignees := coalesce((item->>'changeAssignees')::boolean, false);
    next_sequence := nullif(item->>'routeSequence', '')::integer;
    if next_sequence is not null and next_sequence < 1 then
      raise exception 'invalid_dispatch';
    end if;

    if change_assignees then
      select coalesce(array_agg(x.value::uuid order by x.value::uuid), '{}'::uuid[])
        into next_assignees
      from jsonb_array_elements_text(coalesce(item->'assigneeIds', '[]'::jsonb)) as x(value);

      foreach v_assignee in array next_assignees
      loop
        if not exists (
          select 1
          from public.tenant_memberships m
          where m.tenant_id = p_tenant_id
            and m.user_id = v_assignee
            and m.is_active
        ) then
          raise exception 'cleaner_not_in_tenant';
        end if;
      end loop;

      delete from public.tenant_scheduled_visit_assignees a
      where a.visit_id = v_visit_id
        and not (a.user_id = any (next_assignees));

      insert into public.tenant_scheduled_visit_assignees (visit_id, user_id)
      select v_visit_id, member_id
      from unnest(next_assignees) as member_id
      where not exists (
        select 1
        from public.tenant_scheduled_visit_assignees a
        where a.visit_id = v_visit_id
          and a.user_id = member_id
      );
    end if;

    update public.tenant_scheduled_visits v
    set
      route_sequence = next_sequence,
      staffing_status = case
        when change_assignees and cardinality(next_assignees) = 0
          then 'needs_staffing'::public.visit_staffing_status
        when change_assignees then 'assigned'::public.visit_staffing_status
        else v.staffing_status
      end
    where v.id = v_visit_id
      and v.tenant_id = p_tenant_id;
  end loop;
end;
$$;

revoke all on function public.apply_cleaner_dispatch(uuid, jsonb, jsonb) from public;
revoke all on function public.apply_cleaner_dispatch(uuid, jsonb, jsonb) from anon;
revoke all on function public.apply_cleaner_dispatch(uuid, jsonb, jsonb) from authenticated;
grant execute on function public.apply_cleaner_dispatch(uuid, jsonb, jsonb) to service_role;

comment on function public.apply_cleaner_dispatch(uuid, jsonb, jsonb) is
  'Applies one owner-approved dispatch for a tenant. Rejects a stale snapshot and a visit or cleaner outside that tenant. Does not send email or SMS.';
