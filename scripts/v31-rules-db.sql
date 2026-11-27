-- Disposable CI database only. Fixture identifiers refer to no hosted users.
\set ON_ERROR_STOP on
begin;
do $$ begin if current_database()<>'smart_budget_ci' then raise exception 'Expected disposable database';end if;end $$;
create role anon;
create role authenticated;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.households(id uuid primary key);
create table public.household_members(household_id uuid,user_id uuid);
create table public.categories(id uuid,household_id uuid,legacy_id text,archived_at timestamptz);
create function private.is_household_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.household_members where household_id=target and user_id=auth.uid()) $$;
grant usage on schema private,auth to authenticated;
\ir ../supabase/migrations/20261127190000_assistant_household_rules.sql
insert into public.households values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.household_members values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
insert into auth.users select distinct user_id from public.household_members;
insert into private.v31_pilot_rule_members values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.categories values ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','private-other',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare h uuid:='10000000-0000-4000-8000-000000000001'; result jsonb;
begin
 result:=public.edit_smart_assistant_rule(h,0,'set','lidl','rule:groceries');
 assert result->>'revision'='1';
 result:=public.edit_smart_assistant_rule(h,0,'clear',null,null);
 assert result->>'status'='conflict' and result->'rules'->>'lidl'='rule:groceries';
 begin perform public.edit_smart_assistant_rule(h,1,'set','wrong','id:private-other');raise exception 'foreign category accepted';exception when invalid_parameter_value then null;end;
 begin update public.smart_assistant_household_rules set rules='{}';raise exception 'direct write accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ begin
 assert (select rules->>'lidl'='rule:groceries' from public.smart_assistant_household_rules);
 assert (public.edit_smart_assistant_rule('10000000-0000-4000-8000-000000000001',1,'remove','lidl',null)->>'revision')='2';
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
do $$ begin
 assert not exists(select from public.smart_assistant_household_rules);
 begin perform public.edit_smart_assistant_rule('10000000-0000-4000-8000-000000000001',2,'clear',null,null);raise exception 'cross-household edit accepted';exception when insufficient_privilege then null;end;
 begin perform public.edit_smart_assistant_rule('10000000-0000-4000-8000-000000000002',0,'set','test','rule:food');raise exception 'non-pilot own household edit accepted';exception when insufficient_privilege then null;end;
 assert not has_table_privilege('authenticated','private.v31_pilot_rule_members','insert');
end $$;
\ir v31-movements-db.sql
\ir v31-backup-db.sql
\ir v31-atomic-review-db.sql
rollback;
