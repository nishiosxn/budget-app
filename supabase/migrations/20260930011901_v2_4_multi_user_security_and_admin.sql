create extension if not exists pgcrypto with schema extensions;

-- Server-side global administrators. Browser roles never read or mutate this table.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.app_admins enable row level security;
revoke all on table public.app_admins from public, anon, authenticated;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_user_id uuid references auth.users(id) on delete set null,
  target_household_id uuid references public.households(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;

-- This bootstrap helper is intentionally unavailable through the Data API.
-- Run it once from the SQL editor to designate the first administrator.
create or replace function private.grant_app_admin_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user is null then
    raise exception 'No account exists for this email';
  end if;

  insert into public.app_admins(user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  return v_user;
end;
$$;

revoke all on function private.grant_app_admin_by_email(text) from public, anon, authenticated;

-- Normal sign-ups receive one independent household. The function is idempotent
-- and never attaches a user to another person's household.
create or replace function public.ensure_personal_household(
  p_household_name text default 'Mon foyer',
  p_display_name text default 'Personne 1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
  v_household_name text := left(coalesce(nullif(trim(p_household_name), ''), 'Mon foyer'), 80);
  v_display_name text := left(coalesce(nullif(trim(p_display_name), ''), 'Personne 1'), 60);
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select hm.household_id into v_household
  from public.household_members hm
  where hm.user_id = v_user
  order by hm.joined_at, hm.household_id
  limit 1;

  if v_household is not null then
    return v_household;
  end if;

  v_household := gen_random_uuid();
  insert into public.households(id, name, created_by, person_b_label, person_a_label)
  values (v_household, v_household_name, v_user, v_display_name, 'Personne 2');

  insert into public.household_members(household_id, user_id, display_name, role, slot)
  values (v_household, v_user, v_display_name, 'owner', 'B');

  return v_household;
end;
$$;

revoke all on function public.ensure_personal_household(text, text) from public, anon;
grant execute on function public.ensure_personal_household(text, text) to authenticated;

-- Enforce the two-person household invariant even for privileged writes.
create or replace function private.enforce_household_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'Household already has two members';
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_limit_two on public.household_members;
create trigger household_members_limit_two
before insert on public.household_members
for each row execute function private.enforce_household_member_limit();

-- Replace bearer tokens stored in clear text with SHA-256 digests. Existing
-- UUID invitations remain usable because their digest is migrated first.
alter table public.household_invites add column if not exists token_hash text;

update public.household_invites
set token_hash = encode(extensions.digest(token::text, 'sha256'), 'hex')
where token_hash is null;

alter table public.household_invites alter column token_hash set not null;
alter table public.household_invites
  add constraint household_invites_token_hash_format
  check (token_hash ~ '^[0-9a-f]{64}$') not valid;
alter table public.household_invites validate constraint household_invites_token_hash_format;
create unique index if not exists household_invites_token_hash_unique
  on public.household_invites(token_hash);
alter table public.household_invites drop column token;

drop function if exists public.create_household_invite(uuid, text);
create function public.create_household_invite(
  p_household_id uuid,
  p_slot text default 'A'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Owner required';
  end if;
  if p_slot not in ('B', 'A') then
    raise exception 'Invalid slot';
  end if;
  if (select count(*) from public.household_members where household_id = p_household_id) >= 2 then
    raise exception 'Household already has two members';
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

  insert into public.household_invites(household_id, token_hash, slot, created_by)
  values (p_household_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_slot, v_user);

  return v_token;
end;
$$;

revoke all on function public.create_household_invite(uuid, text) from public, anon;
grant execute on function public.create_household_invite(uuid, text) to authenticated;

drop function if exists public.accept_household_invite(uuid, text);
create function public.accept_household_invite(
  p_token text,
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
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'Invite invalid or expired';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) = 0 then
    raise exception 'Display name required';
  end if;

  select * into v_invite
  from public.household_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
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
    update public.household_invites
    set accepted_by = v_user, accepted_at = now()
    where id = v_invite.id;
    return v_invite.household_id;
  end if;

  if (select count(*) from public.household_members where household_id = v_invite.household_id) >= 2 then
    raise exception 'Household already has two members';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = v_invite.household_id and slot = v_invite.slot
  ) then
    raise exception 'Slot already occupied';
  end if;

  insert into public.household_members(household_id, user_id, display_name, role, slot)
  values (v_invite.household_id, v_user, left(trim(p_display_name), 60), 'member', v_invite.slot);

  update public.household_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke all on function public.accept_household_invite(text, text) from public, anon;
grant execute on function public.accept_household_invite(text, text) to authenticated;

-- Membership changes must go through vetted RPCs. Direct browser mutations are
-- unnecessary and would allow bypassing invitation checks.
revoke insert, update, delete on table public.household_members from authenticated;
revoke insert on table public.households from authenticated;

