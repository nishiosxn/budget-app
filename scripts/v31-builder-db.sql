\set ON_ERROR_STOP on
begin;
do $$ begin if current_database()<>'smart_budget_ci' then raise exception 'Expected disposable database'; end if; end $$;
create role anon;
create role authenticated;
create schema private;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.households(id uuid primary key,name text,created_by uuid references auth.users,
 person_b_label text,person_a_label text,household_mode text default 'couple');
create table public.household_members(household_id uuid references public.households,user_id uuid references auth.users,
 display_name text,role text,slot text,joined_at timestamptz default clock_timestamp(),primary key(household_id,user_id));
create table public.categories(id uuid primary key default gen_random_uuid(),household_id uuid references public.households,
 legacy_id text,name text check(char_length(name) between 1 and 100),type text,group_name text,owner_slot text,is_saving boolean,is_custom boolean,
 created_from date,sort_order int,archived_at timestamptz,unique(household_id,legacy_id));
create table public.budgets(household_id uuid references public.households,category_id uuid references public.categories,
 month date,planned_amount numeric check(planned_amount<>123.45),scope text,owner_slot text,primary key(category_id,month));
create table public.transactions(household_id uuid references public.households);
create table public.recurrences(household_id uuid references public.households);
create table public.household_invites(household_id uuid references public.households);
create table public.account_opening_balances(household_id uuid references public.households,owner_slot text,amount numeric);
-- Minimal prerequisite contract of ensure_personal_household, exercised separately by the existing provisioner.
create function public.ensure_personal_household(p_name text,p_display text) returns uuid
language plpgsql as $$ declare h uuid; begin
 select household_id into h from public.household_members where user_id=auth.uid();
 if h is not null then return h; end if;
 h:=gen_random_uuid();
 insert into public.households(id,name,created_by,person_b_label,person_a_label) values(h,p_name,auth.uid(),p_display,'Personne 2');
 insert into public.household_members(household_id,user_id,display_name,role,slot) values(h,auth.uid(),p_display,'owner','B');
 return h;
end $$;
\ir ../supabase/migrations/20261127210000_budget_builder_atomic.sql

do $$
declare
 actor uuid:='10000000-0000-4000-8000-000000000001';
 other uuid:='10000000-0000-4000-8000-000000000002';
 old_actor uuid:='10000000-0000-4000-8000-000000000003';
 h uuid;
 existing uuid;
 solo uuid;
 req uuid:=gen_random_uuid();
 competing uuid:=gen_random_uuid();
 payload jsonb:='{"name":"Foyer test","personA":"Camille","personB":"Alex","mode":"couple","month":"2026-11-01","appearance":{},"categories":[
 {"id":"salary-b","name":"Revenu","type":"income","owner":"B","saving":false,"custom":false,"amountCents":145601},
 {"id":"setup-sub-music","name":"Musique","type":"expense","owner":"A","section":"Abonnements","saving":false,"custom":true,"amountCents":833},
 {"id":"saving-a","name":"Épargne","type":"expense","owner":"A","section":"Obligatoires","saving":true,"custom":false,"amountCents":12345}
 ]}';
 receipt jsonb;
begin
 insert into auth.users values(actor),(other),(old_actor);
 insert into private.v31_pilot_builder_users values(actor),(other);
 assert not has_table_privilege('authenticated','private.v31_pilot_builder_users','insert');
 assert not has_table_privilege('authenticated','private.budget_builder_setup','select');
 assert not has_function_privilege('anon','public.budget_builder_setup(uuid,text,uuid,jsonb)','execute');

 perform set_config('request.jwt.claim.sub',old_actor::text,true);
 existing:=public.ensure_personal_household('Foyer existant','Pat');
 insert into public.transactions values(existing);
 insert into public.recurrences values(existing);
 begin
  perform public.provision_budget_builder('Autre','Autre');
  raise exception 'Non-pilot provision accepted';
 exception when insufficient_privilege then null;
 end;
 assert public.budget_builder_setup(existing)->>'status'='unavailable';

 perform set_config('request.jwt.claim.sub',actor::text,true);
 h:=public.provision_budget_builder('Provisoire','Alex');
 assert public.provision_budget_builder('Ignoré','Ignoré')=h;
 assert public.budget_builder_setup(h)->>'status'='pending';
 begin
  perform public.budget_builder_setup(h,'stage',req,jsonb_set(payload,'{categories,0,name}',to_jsonb(repeat('X',101))));
  raise exception 'Oversize category was staged';
 exception when invalid_parameter_value then null;
 end;
 assert public.budget_builder_setup(h)->>'status'='pending';
 begin
  perform public.budget_builder_setup(h,'stage',req,jsonb_set(payload,'{categories,0,id}','"v31-compat-base-income"'));
  raise exception 'Reserved category ID accepted';
 exception when invalid_parameter_value then null;
 end;
 assert public.budget_builder_setup(h)->>'status'='pending';
 -- The boundary must be accepted by both the stage validator and the actual constraint.
 payload:=jsonb_set(payload,'{categories,0,name}',to_jsonb(repeat('X',100)));
 assert public.budget_builder_setup(h,'stage',req,payload)->>'status'='staged';
 receipt:=public.budget_builder_setup(h,'stage',competing,payload);
 assert receipt->>'requestId'=req::text;
 assert receipt->'draft'=payload;
 assert not exists(select from public.categories where household_id=h);
 begin
  perform public.budget_builder_setup(h,'commit',req);
  raise exception 'Expected failure between tables';
 exception when check_violation then null;
 end;
 assert (select name='Provisoire' from public.households where id=h);
 assert not exists(select from public.categories where household_id=h);
 assert not exists(select from public.budgets where household_id=h);
 assert public.budget_builder_setup(h)->'draft'=payload;

 perform set_config('request.jwt.claim.sub',other::text,true);
 begin
  perform public.budget_builder_setup(h);
  raise exception 'Another household could read the staged plan';
 exception when insufficient_privilege then null;
 end;
 alter table public.budgets drop constraint budgets_planned_amount_check;

 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.account_opening_balances values(h,'B',34.56);
 receipt:=public.budget_builder_setup(h,'commit',req);
 assert receipt->>'status'='complete';
 assert public.budget_builder_setup(h)=receipt;
 assert public.budget_builder_setup(h,'commit',req)=receipt;
 assert (select count(*)=3 and sum(planned_amount)=1587.79 from public.budgets where household_id=h);
 assert (select count(*)=3 from public.categories where household_id=h and archived_at is null);
 assert not exists(select 1 from public.categories where household_id=h and archived_at is not null);
 assert (select count(*)=1 from public.household_members where household_id=h and display_name='Alex' and slot='B');
 assert (select person_a_label='Camille' and household_mode='couple' from public.households where id=h);
 assert (select amount=34.56 from public.account_opening_balances where household_id=h);
 assert not exists(select from public.transactions where household_id=h);
 assert not exists(select from public.recurrences where household_id=h);
 assert (select count(*)=1 from public.transactions where household_id=existing);
 assert (select count(*)=1 from public.recurrences where household_id=existing);
 assert (select name='Foyer existant' from public.households where id=existing);

 perform set_config('request.jwt.claim.sub',other::text,true);
 solo:=public.provision_budget_builder('Solo','Sam');
 payload:=jsonb_set(jsonb_set(payload,'{mode}','"solo"'),'{categories}',jsonb_build_array(payload->'categories'->0));
 assert public.budget_builder_setup(solo,'stage',req,payload)->>'status'='staged';
 assert public.budget_builder_setup(solo,'commit',req)->>'status'='complete';
 assert (select count(*)=1 and sum(planned_amount)=1456.01 from public.budgets where household_id=solo);
 assert (select count(*)=1 from public.categories where household_id=solo and archived_at is null);
 assert (select count(*)=1 from public.categories where household_id=solo and legacy_id='v31-compat-base-expense' and archived_at is not null and not is_custom);
 assert not exists(select 1 from public.budgets b join public.categories c on c.id=b.category_id where c.legacy_id like 'v31-compat-base-%');
 assert (select household_mode='solo' from public.households where id=solo);
end $$;
rollback;
