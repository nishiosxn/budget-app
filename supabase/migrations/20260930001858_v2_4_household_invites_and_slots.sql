alter table public.household_members
  add column if not exists slot text;

alter table public.household_members
  drop constraint if exists household_members_slot_check;

alter table public.household_members
  add constraint household_members_slot_check
  check (slot is null or slot in ('B','A'));

create unique index if not exists household_members_household_slot_unique
  on public.household_members(household_id, slot)
  where slot is not null;

alter table public.categories
  add column if not exists owner_slot text,
  add column if not exists excluded_months jsonb not null default '[]'::jsonb,
  add column if not exists is_custom boolean not null default false;

alter table public.categories
  drop constraint if exists categories_owner_slot_check;

alter table public.categories
  add constraint categories_owner_slot_check
  check (owner_slot is null or owner_slot in ('B','A'));

alter table public.transactions
  add column if not exists owner_slot text;

alter table public.transactions
  drop constraint if exists transactions_owner_slot_check;

alter table public.transactions
  add constraint transactions_owner_slot_check
  check (owner_slot is null or owner_slot in ('B','A'));

alter table public.recurrences
  add column if not exists legacy_id text,
  add column if not exists owner_slot text;

alter table public.recurrences
  drop constraint if exists recurrences_owner_slot_check;

alter table public.recurrences
  add constraint recurrences_owner_slot_check
  check (owner_slot is null or owner_slot in ('B','A'));

create unique index if not exists recurrences_household_legacy_unique
  on public.recurrences(household_id, legacy_id)
  where legacy_id is not null;

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  slot text not null check (slot in ('B','A')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);

alter table public.household_invites enable row level security;

drop policy if exists "owners can read invites" on public.household_invites;
create policy "owners can read invites"
on public.household_invites
for select to authenticated
using (private.is_household_owner(household_id));

drop policy if exists "owners can delete invites" on public.household_invites;
create policy "owners can delete invites"
on public.household_invites
for delete to authenticated
using (private.is_household_owner(household_id));

create or replace function public.create_household(
  p_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Household name required';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) = 0 then
    raise exception 'Display name required';
  end if;

  insert into public.households(id,name,created_by)
  values(v_household,trim(p_name),v_user);

  insert into public.household_members(household_id,user_id,display_name,role,slot)
  values(v_household,v_user,trim(p_display_name),'owner','B');

  return v_household;
end;
$$;

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_slot text default 'A'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Owner required';
  end if;
  if p_slot not in ('B','A') then
    raise exception 'Invalid slot';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = p_household_id and slot = p_slot
  ) then
    raise exception 'Slot already occupied';
  end if;

  delete from public.household_invites
  where household_id = p_household_id
    and slot = p_slot
    and accepted_at is null;

  insert into public.household_invites(household_id,token,slot,created_by)
  values(p_household_id,v_token,p_slot,v_user);

  return v_token;
end;
$$;

create or replace function public.accept_household_invite(
  p_token uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.household_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) = 0 then
    raise exception 'Display name required';
  end if;

  select *
  into v_invite
  from public.household_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite invalid or expired';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = v_invite.household_id and user_id = v_user
  ) then
    return v_invite.household_id;
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = v_invite.household_id and slot = v_invite.slot
  ) then
    raise exception 'Slot already occupied';
  end if;

  insert into public.household_members(household_id,user_id,display_name,role,slot)
  values(v_invite.household_id,v_user,trim(p_display_name),'member',v_invite.slot);

  update public.household_invites
  set accepted_by = v_user,
      accepted_at = now()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke all on table public.household_invites from anon, authenticated;
grant select, delete on table public.household_invites to authenticated;

revoke all on function public.create_household_invite(uuid,text) from public, anon;
grant execute on function public.create_household_invite(uuid,text) to authenticated;

revoke all on function public.accept_household_invite(uuid,text) from public, anon;
grant execute on function public.accept_household_invite(uuid,text) to authenticated;

grant update (slot) on table public.household_members to authenticated;
grant update (owner_slot, excluded_months, is_custom) on table public.categories to authenticated;
grant update (owner_slot) on table public.transactions to authenticated;
grant update (legacy_id, owner_slot) on table public.recurrences to authenticated;
