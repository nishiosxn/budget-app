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
alter publication supabase_realtime add table public.households,public.household_members;

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
 new.updated_at=now();
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

\ir historical-production-contract.sql

-- A synthetic V3.0.2 ledger stays present during the upgrade.
insert into auth.users(id,email) values('90ce62fb-4c40-4f08-9d41-2e2847e67809','preexisting@example.test');
insert into public.households(id,name,created_by,household_mode)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','Historique fictif','90ce62fb-4c40-4f08-9d41-2e2847e67809','solo');
insert into public.household_members(household_id,user_id,role,display_name,slot)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','90ce62fb-4c40-4f08-9d41-2e2847e67809','owner','Ancien compte','B');
insert into public.categories(id,household_id,legacy_id,name,type,created_from,owner_slot)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67811','90ce62fb-4c40-4f08-9d41-2e2847e67810','historical','Historique','expense','2025-01-01','B');
insert into public.budgets(household_id,category_id,month,planned_amount,scope,owner_slot)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','90ce62fb-4c40-4f08-9d41-2e2847e67811','2025-01-01',250.01,'forward','B');
insert into public.transactions(household_id,category_id,legacy_id,amount,transaction_date,owner_slot,archived_at)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','90ce62fb-4c40-4f08-9d41-2e2847e67811','archive',12.05,'2025-01-02','B','2025-02-01');
insert into public.recurrences(household_id,category_id,start_month,start_day,amount,owner_slot)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','90ce62fb-4c40-4f08-9d41-2e2847e67811','2025-01-01',31,10.02,'B');
insert into public.account_opening_balances(household_id,month,owner_slot,amount)
 values('90ce62fb-4c40-4f08-9d41-2e2847e67810','2025-01-01','B',31.01);
create temporary view preexisting_ledger as
 select jsonb_build_array(to_jsonb(h),to_jsonb(m),to_jsonb(c),to_jsonb(b),to_jsonb(t),to_jsonb(r),to_jsonb(a)) as snapshot
 from public.households h join public.household_members m on m.household_id=h.id
 join public.categories c on c.household_id=h.id join public.budgets b on b.category_id=c.id
 join public.transactions t on t.category_id=c.id join public.recurrences r on r.category_id=c.id
 join public.account_opening_balances a on a.household_id=h.id
 where h.id='90ce62fb-4c40-4f08-9d41-2e2847e67810';
create temporary table preexisting_before as table preexisting_ledger;

\ir ../../supabase/migrations/20261117235347_smart_assistant_quota_pilot.sql
\ir historical-quota-status.sql
\ir ../../supabase/migrations/20261121183000_smart_assistant_pilot_category_creation.sql
\ir ../../supabase/migrations/20261121194000_smart_assistant_pilot_category_expense_atomic.sql
\ir ../../supabase/migrations/20261121195500_smart_assistant_pilot_atomic_batch.sql
\ir ../../supabase/migrations/20261121201000_smart_assistant_pilot_forward_override_guard.sql
\ir ../../supabase/migrations/20261127190000_assistant_household_rules.sql
\ir ../../supabase/migrations/20261127193000_assistant_confirm_movements.sql
\ir ../../supabase/migrations/20261127210000_budget_builder_atomic.sql
\ir ../../supabase/migrations/20261127220000_assistant_atomic_review.sql
do $$ begin
 assert (select count(*) from preexisting_before)=1;
 assert (select count(*) from preexisting_ledger)=1;
 assert (select snapshot from preexisting_before)=(select snapshot from preexisting_ledger);
end $$;
notify pgrst, 'reload schema';
