-- DapurKu v3.3 Sync Fix migration
-- Run ONCE in Supabase > SQL Editor if you previously ran the v3/v3.2 setup.
-- This keeps pantry/shopping/history/custom recipe records, merges duplicate kitchens
-- owned by the same account, and prevents duplicate owner kitchens from being created again.

begin;

-- Normalize member emails so invite claiming behaves consistently across devices.
update public.dapurku_members
set email = lower(trim(email));

-- Merge duplicate households owned by the same user into the earliest household.
do $$
declare
  v_owner uuid;
  v_keep uuid;
  v_dup uuid;
begin
  for v_owner in
    select owner_id
    from public.dapurku_households
    group by owner_id
    having count(*) > 1
  loop
    select id into v_keep
    from public.dapurku_households
    where owner_id = v_owner
    order by created_at asc, id asc
    limit 1;

    for v_dup in
      select id
      from public.dapurku_households
      where owner_id = v_owner and id <> v_keep
      order by created_at asc, id asc
    loop
      -- Merge members. If the same email exists twice, preserve a claimed user_id.
      insert into public.dapurku_members(household_id,user_id,email,role,created_at)
      select
        v_keep,
        m.user_id,
        lower(trim(m.email)),
        case when m.user_id = v_owner then 'owner' else 'member' end,
        m.created_at
      from public.dapurku_members m
      where m.household_id = v_dup
      on conflict (household_id,email) do update
      set user_id = coalesce(public.dapurku_members.user_id, excluded.user_id),
          role = case
            when coalesce(public.dapurku_members.user_id, excluded.user_id) = v_owner then 'owner'
            else 'member'
          end;

      -- Merge data. If the same record exists in both kitchens, newest updated_at wins.
      insert into public.dapurku_records(household_id,store,record_id,payload,is_deleted,updated_at,updated_by)
      select v_keep,r.store,r.record_id,r.payload,r.is_deleted,r.updated_at,r.updated_by
      from public.dapurku_records r
      where r.household_id = v_dup
      on conflict (household_id,store,record_id) do update
      set payload = excluded.payload,
          is_deleted = excluded.is_deleted,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      where excluded.updated_at >= public.dapurku_records.updated_at;

      delete from public.dapurku_households where id = v_dup;
    end loop;

    -- Ensure the canonical household has one correct owner membership.
    insert into public.dapurku_members(household_id,user_id,email,role)
    select v_keep,u.id,lower(u.email),'owner'
    from auth.users u
    where u.id = v_owner
    on conflict (household_id,email) do update
    set user_id=excluded.user_id, role='owner';
  end loop;
end $$;

-- One account can own only one auto-created DapurKu household.
create unique index if not exists dapurku_households_one_owner_idx
on public.dapurku_households(owner_id);

-- Replace the old create function with an idempotent get-or-create function.
create or replace function public.dapurku_create_household(p_name text default 'Our Kitchen')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_id uuid;
begin
  if v_uid is null or v_email = '' then raise exception 'Authentication required'; end if;

  select h.id into v_id
  from public.dapurku_households h
  where h.owner_id = v_uid
  order by h.created_at asc
  limit 1;

  if v_id is null then
    insert into public.dapurku_households(name,owner_id)
    values (coalesce(nullif(trim(p_name),''),'Our Kitchen'),v_uid)
    on conflict (owner_id) do update set owner_id=excluded.owner_id
    returning id into v_id;
  end if;

  insert into public.dapurku_members(household_id,user_id,email,role)
  values (v_id,v_uid,v_email,'owner')
  on conflict (household_id,email) do update
  set user_id=excluded.user_id, role='owner';

  return v_id;
end;
$$;

revoke execute on function public.dapurku_create_household(text) from public;
grant execute on function public.dapurku_create_household(text) to authenticated;

commit;
