-- DapurKu v3 Family Sync setup for Supabase
-- Run this entire script once in Supabase > SQL Editor.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.dapurku_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Kitchen',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dapurku_members (
  household_id uuid not null references public.dapurku_households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (household_id, email)
);
create unique index if not exists dapurku_members_household_user_idx
  on public.dapurku_members(household_id,user_id) where user_id is not null;

create table if not exists public.dapurku_records (
  household_id uuid not null references public.dapurku_households(id) on delete cascade,
  store text not null check (store in ('items','shopping','history','recipes')),
  record_id text not null,
  payload jsonb,
  is_deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (household_id, store, record_id)
);

alter table public.dapurku_households enable row level security;
alter table public.dapurku_members enable row level security;
alter table public.dapurku_records enable row level security;

revoke all on table public.dapurku_households from anon;
revoke all on table public.dapurku_members from anon;
revoke all on table public.dapurku_records from anon;
grant select on table public.dapurku_households to authenticated;
grant select on table public.dapurku_members to authenticated;
grant select,insert,update,delete on table public.dapurku_records to authenticated;

create or replace function private.dapurku_household_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select m.household_id
  from public.dapurku_members m
  where m.user_id = (select auth.uid());
$$;
revoke execute on function private.dapurku_household_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.dapurku_household_ids() to authenticated;

drop policy if exists "dapurku households read" on public.dapurku_households;
create policy "dapurku households read" on public.dapurku_households
for select to authenticated
using (id in (select private.dapurku_household_ids()));

drop policy if exists "dapurku members read" on public.dapurku_members;
create policy "dapurku members read" on public.dapurku_members
for select to authenticated
using (household_id in (select private.dapurku_household_ids()));

drop policy if exists "dapurku records read" on public.dapurku_records;
create policy "dapurku records read" on public.dapurku_records
for select to authenticated
using (household_id in (select private.dapurku_household_ids()));

drop policy if exists "dapurku records insert" on public.dapurku_records;
create policy "dapurku records insert" on public.dapurku_records
for insert to authenticated
with check (household_id in (select private.dapurku_household_ids()));

drop policy if exists "dapurku records update" on public.dapurku_records;
create policy "dapurku records update" on public.dapurku_records
for update to authenticated
using (household_id in (select private.dapurku_household_ids()))
with check (household_id in (select private.dapurku_household_ids()));

drop policy if exists "dapurku records delete" on public.dapurku_records;
create policy "dapurku records delete" on public.dapurku_records
for delete to authenticated
using (household_id in (select private.dapurku_household_ids()));

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
  insert into public.dapurku_households(name,owner_id)
  values (coalesce(nullif(trim(p_name),''),'Our Kitchen'),v_uid)
  returning id into v_id;
  insert into public.dapurku_members(household_id,user_id,email,role)
  values (v_id,v_uid,v_email,'owner');
  return v_id;
end;
$$;
revoke execute on function public.dapurku_create_household(text) from public;
grant execute on function public.dapurku_create_household(text) to authenticated;

create or replace function public.dapurku_invite_email(p_household_id uuid,p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_target uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_email = '' then raise exception 'Email is required'; end if;
  if v_email = lower(coalesce(auth.jwt()->>'email','')) then raise exception 'That email is already the kitchen owner'; end if;
  if not exists(select 1 from public.dapurku_households h where h.id=p_household_id and h.owner_id=v_uid) then
    raise exception 'Only the kitchen owner can add members';
  end if;
  select u.id into v_target from auth.users u where lower(u.email)=v_email limit 1;
  insert into public.dapurku_members(household_id,user_id,email,role)
  values (p_household_id,v_target,v_email,'member')
  on conflict (household_id,email) do update set user_id=coalesce(excluded.user_id,public.dapurku_members.user_id),role='member';
end;
$$;
revoke execute on function public.dapurku_invite_email(uuid,text) from public;
grant execute on function public.dapurku_invite_email(uuid,text) to authenticated;

create or replace function public.dapurku_claim_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_count integer;
begin
  if v_uid is null or v_email='' then return 0; end if;
  update public.dapurku_members
  set user_id=v_uid
  where user_id is null and lower(email)=v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.dapurku_claim_invites() from public;
grant execute on function public.dapurku_claim_invites() to authenticated;

alter table public.dapurku_records replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='dapurku_records'
  ) then
    alter publication supabase_realtime add table public.dapurku_records;
  end if;
end $$;
