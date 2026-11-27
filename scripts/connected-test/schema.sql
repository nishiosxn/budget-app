\set ON_ERROR_STOP on
-- Contract fixture for a fresh local Supabase CLI stack. No production schema or data dump.
do $$ begin
 if inet_server_port()<>5432 or current_database()<>'postgres'
    or exists(select from auth.users) or to_regclass('public.households') is not null then
  raise exception 'Expected a fresh disposable Supabase instance';
 end if;
end $$;
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.households(
 id uuid primary key default gen_random_uuid(),name text not null,
 created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.household_members(
 household_id uuid references public.households,user_id uuid references auth.users,
 role text not null,display_name text not null,joined_at timestamptz not null default now(),
 primary key(household_id,user_id)
);
create function private.is_household_member(h uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select from public.household_members where household_id=h and user_id=(select auth.uid()))
 $$;
create function private.is_household_owner(h uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select from public.household_members where household_id=h and user_id=(select auth.uid()) and role='owner')
 $$;
revoke all on function private.is_household_member(uuid),private.is_household_owner(uuid) from public;
grant execute on function private.is_household_member(uuid),private.is_household_owner(uuid) to authenticated;

create table public.categories(
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,
 legacy_id text,name text not null,type text not null check(type in ('income','expense')),group_name text,
 is_saving boolean not null default false,created_from date not null,sort_order integer not null default 0,
 owner_user_id uuid references auth.users,archived_at timestamptz,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),unique(household_id,id)
);
create table public.budgets(
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,
 category_id uuid not null,month date not null,planned_amount numeric not null check(planned_amount>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(household_id,category_id) references public.categories(household_id,id),unique(household_id,category_id,month)
);
create table public.recurrences(
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,
 category_id uuid not null,owner_user_id uuid references auth.users,start_month date not null,end_month date,
 amount numeric not null,label text,overrides jsonb not null default '{}',excluded_months jsonb not null default '[]',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(household_id,category_id) references public.categories(household_id,id)
);
create table public.transactions(
 id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,
 category_id uuid not null,legacy_id text,owner_user_id uuid references auth.users,recurrence_id uuid references public.recurrences,
 amount numeric not null,transaction_date date not null,label text,is_adjustment boolean not null default false,adjustment_label text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(household_id,category_id) references public.categories(household_id,id)
);

alter table public.households enable row level security;
create policy member_households on public.households for select to authenticated using(private.is_household_member(id));
create policy owner_household_labels on public.households for update to authenticated
 using(private.is_household_owner(id)) with check(private.is_household_owner(id));
alter table public.household_members enable row level security;
create policy member_roster on public.household_members for select to authenticated using(private.is_household_member(household_id));
grant select on public.households,public.household_members to authenticated;
grant update(name) on public.households to authenticated;

-- Only the fixture policies below are reconstructed. Versioned policies/RPCs are loaded verbatim.
do $$
declare t text;
begin
 foreach t in array array['categories','budgets','transactions','recurrences'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy members_read on public.%I for select to authenticated using(private.is_household_member(household_id))',t);
  execute format('create policy members_insert on public.%I for insert to authenticated with check(private.is_household_member(household_id))',t);
  execute format('create policy members_update on public.%I for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id))',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('alter publication supabase_realtime add table public.%I',t);
 end loop;
end $$;
-- The oldest checked-in compatibility migration revokes this historic RPC.
create function public.rls_auto_enable() returns void language plpgsql as $$ begin return; end $$;
-- The historical contract exposes row revisions for optimistic sync.
create function private.fixture_touch_revision() returns trigger language plpgsql as $$
begin
 new.updated_at=clock_timestamp();
 return new;
end $$;
do $$
declare t text;
begin
 foreach t in array array['households','categories','budgets','transactions','recurrences'] loop
  execute format('create trigger fixture_touch_revision before update on public.%I for each row execute function private.fixture_touch_revision()',t);
 end loop;
end $$;
\ir ../../supabase/migrations/20260930001858_v2_4_household_invites_and_slots.sql
\ir ../../supabase/migrations/20260930002106_v2_4_sync_fields_and_security_hardening.sql
\ir ../../supabase/migrations/20260930002728_v2_4_archive_sync_rows.sql
\ir ../../supabase/migrations/20260930011901_v2_4_multi_user_security_and_admin.sql
\ir ../../supabase/migrations/20260930104500_v2_5_sync_deduplication.sql
\ir ../../supabase/migrations/20261003121500_v2_6_account_opening_balances.sql
\ir ../../supabase/migrations/20261003123000_v2_6_account_opening_balances_realtime.sql
\ir ../../supabase/migrations/20261006190000_v2_7_schema_alignment_and_index_cleanup.sql
\ir ../../supabase/migrations/20261117235347_smart_assistant_quota_pilot.sql
\ir ../../supabase/migrations/20261121183000_smart_assistant_pilot_category_creation.sql
\ir ../../supabase/migrations/20261121194000_smart_assistant_pilot_category_expense_atomic.sql
\ir ../../supabase/migrations/20261121195500_smart_assistant_pilot_atomic_batch.sql
\ir ../../supabase/migrations/20261121201000_smart_assistant_pilot_forward_override_guard.sql
\ir ../../supabase/migrations/20261127190000_assistant_household_rules.sql
\ir ../../supabase/migrations/20261127193000_assistant_confirm_movements.sql
\ir ../../supabase/migrations/20261127210000_budget_builder_atomic.sql
\ir ../../supabase/migrations/20261127220000_assistant_atomic_review.sql
notify pgrst, 'reload schema';
