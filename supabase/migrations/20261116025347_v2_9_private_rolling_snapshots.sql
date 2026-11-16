-- V2.9: private snapshots; never grant API access to this schema.
create schema if not exists smart_budget_backups;
revoke all on schema smart_budget_backups from public,anon,authenticated,service_role;
create table if not exists smart_budget_backups.snapshots (
 id bigint generated always as identity primary key,
 captured_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 reason text not null check(reason in ('scheduled','manual','pre_restore'))
);
create index if not exists smart_budget_backup_captured_idx on smart_budget_backups.snapshots(captured_at desc);
create table if not exists smart_budget_backups.snapshot_tables (
 snapshot_id bigint not null references smart_budget_backups.snapshots(id) on delete cascade,
 source_table text not null check(source_table in ('households','household_members','household_invites','categories','budgets','transactions','recurrences','account_opening_balances')),
 row_count bigint not null check(row_count >= 0),
 rows jsonb not null check(jsonb_typeof(rows)='array'),
 primary key(snapshot_id,source_table)
);
alter table smart_budget_backups.snapshots enable row level security;
alter table smart_budget_backups.snapshot_tables enable row level security;
revoke all on all tables in schema smart_budget_backups from public,anon,authenticated,service_role;
revoke all on all sequences in schema smart_budget_backups from public,anon,authenticated,service_role;
create or replace function smart_budget_backups.capture_snapshot(p_reason text default 'scheduled') returns bigint
language plpgsql security invoker set search_path=pg_catalog as $fn$
declare v_id bigint; v_count bigint;
begin
 if current_user<>'postgres' then raise exception 'Operator-only backups'; end if;
 if p_reason is null or p_reason not in ('scheduled','manual','pre_restore') then raise exception 'Invalid backup reason'; end if;
 insert into smart_budget_backups.snapshots(reason) values(p_reason) returning id into v_id;
 -- This single INSERT ... SELECT statement reads all public tables in one MVCC snapshot.
 insert into smart_budget_backups.snapshot_tables(snapshot_id,source_table,row_count,rows)
select v_id,'households',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.households t
union all
select v_id,'household_members',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.household_members t
union all
select v_id,'household_invites',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.household_invites t
union all
select v_id,'categories',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.categories t
union all
select v_id,'budgets',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.budgets t
union all
select v_id,'transactions',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.transactions t
union all
select v_id,'recurrences',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.recurrences t
union all
select v_id,'account_opening_balances',count(*)::bigint,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.account_opening_balances t;
 select count(*) into v_count from smart_budget_backups.snapshot_tables where snapshot_id=v_id;
 if v_count<>8 then raise exception 'Incomplete snapshot: % of 8 tables',v_count; end if;
 update smart_budget_backups.snapshots set completed_at=clock_timestamp() where id=v_id;
 -- Never prune manual or pre_restore snapshots. Incident-20261116 backups are a separate schema.
 delete from smart_budget_backups.snapshots where reason='scheduled' and completed_at is not null and captured_at<clock_timestamp()-interval '30 days';
 return v_id;
end
$fn$;
revoke all on function smart_budget_backups.capture_snapshot(text) from public,anon,authenticated,service_role;
comment on schema smart_budget_backups is 'Private in-database financial snapshots; not offsite backups.';
